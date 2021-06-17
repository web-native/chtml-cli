
/**
 * @imports
 */
import Fs from 'fs';
import Path from 'path';
import _each from '@webqit/util/obj/each.js';
import _merge from '@webqit/util/obj/merge.js'
import _isObject from '@webqit/util/js/isObject.js';
import _isNumeric from '@webqit/util/js/isNumeric.js';
import _isFunction from '@webqit/util/js/isFunction.js';
import _beforeLast from '@webqit/util/str/beforeLast.js';
import _before from '@webqit/util/str/before.js';
import _after from '@webqit/util/str/after.js';
import _toTitle from '@webqit/util/str/toTitle.js';
import _preceding from '@webqit/util/arr/preceding.js';
import _following from '@webqit/util/arr/following.js';
import Lexer from '@webqit/util/str/Lexer.js';

/**
 * ---------------------------
 * The Bundler class
 * ---------------------------
 */
export default class Bundler {
		
	/**
	 * Bundles and saves (multiple).
	 *
	 * @param string|object	from
	 * @param string		to
	 * @param object		params
	 *
	 * @return string|object
	 */
	static async bundle(from, to = null, params = {}) {
		if (_isObject(from)) {
			var fromNames = Object.keys(from), bundles = {};

			var readShift = async () => {
				var name;
				if (!(name = fromNames.shift())) {
					return;
				}
				var saveName = to ? to.replace(/\[name\]/g, name) : '';
				var _params = {...params};
				_params.ENTRY_DIR = from[name];
				var bundler = await Bundler.readdir(from[name], _params);
				bundles[name] = bundler.output(saveName);
				await readShift();
			};
			await readShift();

			return bundles;
		}
		return (await Bundler.readdir(from, params)).output(to);
	}

	/**
	 * Mounts a Bundler instance over a directory
	 * and runs the directory-reading and files-loading process.
	 *
	 * @param string		baseDir
	 * @param object		params
	 *
	 * @return void
	 */
	static async readdir(basePath, params) {
		const bundler = new Bundler(basePath, params);
		// --------------------------------
		var load = async (resource, paramsCopy, errors, meta) => {
			var callLoader = async function(index, resource, recieved) {
				if (bundler.params.LOADERS && bundler.params.LOADERS[index]) {
					var loader = bundler.params.LOADERS[index];
					try {
						return await loader.load(resource, paramsCopy, loader.args, recieved, meta, async (...args) => {
							return await callLoader(index + 1, resource, ...args);
						});
					} catch(e) {
						errors[resource] = e;
					}
				}
				if (!recieved) {
					return bundler.load(resource, params);
				}
				return recieved;
			};
			return await callLoader(0, resource);
		};
		// --------------------------------
		var resources = Fs.readdirSync(bundler.baseDir);
		var readShift = async () => {
			var resourceName;
			if (!(resourceName = resources.shift())) {
				return;
			}
			let resource = Path.join(bundler.baseDir, resourceName);
			var basename = resourceName;
			if (Fs.statSync(resource).isDirectory()) {
				if (!(bundler.params.IGNORE_FOLDERS_BY_PREFIX || []).filter(prfx => resourceName.substr(0, prfx.length) === prfx).length) {
					var _params = {...bundler.params};
					_params.indentation ++;
					if (('SHOW_OUTLINE_NUMBERING' in bundler.params) && !bundler.params.SHOW_OUTLINE_NUMBERING && _isNumeric(_before(basename, '-'))) {
						basename = _after(basename, '-');
					}
					bundler.outline[basename] = await Bundler.readdir(resource, _params);
				}
			} else {
				var paramsCopy = {...bundler.params}, errors = {}, meta = {};
				if (!bundler.params.loadStart || bundler.params.loadStart(resource, paramsCopy) !== false) {
					var content = await load(resource, paramsCopy, errors, meta);
					if (bundler.params.loadEnd) {
						bundler.params.loadEnd(resource, paramsCopy, content, errors, meta);
					}
					basename = _beforeLast(basename, '.').toLowerCase();
					bundler.outline[basename] = {
						content,
						errors,
						meta,
					};
				}
			}
			await readShift();
		};
		await readShift();

		return bundler;
	}
		
	/**
	 * A Bundler instance.
	 *
	 * @param string		baseDir
	 * @param object		params
	 *
	 * @return void
	 */
	constructor(baseDir, params = {}) {
		if (!baseDir.endsWith('/')) {
			baseDir += '/';
		}
		this.baseDir = baseDir;
		this.params = params;
		this.params.ASSETS_PUBLIC_BASE = this.params.ASSETS_PUBLIC_BASE || '/';
		this.params.indentation = this.params.indentation || 0;
		// ----------------------------------------
		const divideByComment = tag => {
			var _comment = '', _tag;
			if (tag.startsWith('<!--')) {
				_comment = _before(tag, '-->') + '-->';
				_tag = _after(tag, '-->');
			} else {
				_tag = tag;
			}
			// Shift whitespace too
			_comment += _before(_tag, '<');
			tag = '<' + _after(_tag, '<');
			return [_comment, _tag];
		};
		// ----------------------------------------
		this.params.getAttributeDefinition = (tag, attributeName) => {
			var [ comment, tag ] = divideByComment(tag);
			// --------------
			var regexes = [' ' + attributeName + '([ ]+)?=([ ]+)?"([^"])+"', " " + attributeName + "([ ]+)?=([ ]+)?'([^'])+'"];
			return regexes.reduce((result, regex) => {
				return result || Lexer.match(tag, regex, {stopChars: '>', useRegex:'i', blocks:[]})[0];
			}, '');
		};
		this.params.defineAttribute = (tag, attributeName, attributeValue) => {
			var [ comment, tag ] = divideByComment(tag);
			// --------------
			var parts = Lexer.split(tag, '>', {limit: 1, blocks:[]});
			return comment + parts[0] + ' ' + attributeName + '="' + attributeValue + '">' + parts[1];
		};
		// -----------------------------------------
		this.outline = {};
	}
		
	/**
	 * Loads a file and appends it
	 * to the bundle on the specified namespace.
	 *
	 * @param string		file
	 * @param object		params
	 *
	 * @return string|function
	 */
	load(file, params) {
		var ext = Path.extname(file) || '';
		var exportGroup = _beforeLast(Path.basename(file), '.').toLowerCase();
		var createExport = (content, exportGroup) => {
			if (params.EXPORT_MODE === 'element' && params.EXPORT_ELEMENT && params.EXPORT_ID_ATTR) {
				return '<' + params.EXPORT_ELEMENT + ' ' + params.EXPORT_ID_ATTR + '="' + exportGroup + '">' + content + '</' + params.EXPORT_ELEMENT + '>';
			} else if (params.EXPORT_MODE === 'attribute' && params.EXPORT_GROUP_ATTR && !params.getAttributeDefinition(content, params.EXPORT_GROUP_ATTR)) {
				return params.defineAttribute(content, params.EXPORT_GROUP_ATTR, exportGroup);
			}
			return content;
		};
		if (ext in Bundler.mime) {
			return assetsDir => {
				if (Fs.statSync(file).size < params.MAX_DATA_URL_SIZE) {
					var url = 'data:' + Bundler.mime[ext] + ';base64,' + Fs.readFileSync(file).toString('base64');
				} else {
					var absFilename = Path.join(assetsDir || this.baseDir, Path.basename(file));
					Fs.mkdirSync(Path.dirname(absFilename), {recursive:true});
					Fs.copyFileSync(file, absFilename);
					var assetsPublicFilename = getPublicFilename(absFilename, params.indentation);
					var url = params.ASSETS_PUBLIC_BASE + assetsPublicFilename;
				}
				var img = `<img src="${url}" />`;
				return createExport(img, exportGroup);
			};
		} else {
			var contents = Fs.readFileSync(file).toString();
			var contentsTrimmed = contents.trim();
			if (contentsTrimmed.startsWith('<') && !contentsTrimmed.startsWith('<!DOCTYPE') && !contentsTrimmed.startsWith('<?xml')) {
				return createExport(contentsTrimmed, exportGroup);
			}
		}
	}
		
	/**
	 * Stringifies the bundle
	 * and optionally saves it to a Path.
	 *
	 * @param string			outputFile
	 * @param object			outline
	 * @param string			name
	 *
	 * @return string
	 */
	output(outputFile = null, outline = {}, name = null) {
		// -----------------------------------------
		var outputFileExt, outputDir, src;
		if (outputFile) {
			if (!Path.isAbsolute(outputFile)) {
				outputFile = Path.resolve(this.baseDir, outputFile);
			}
			if (!name && (outputFileExt = Path.extname(outputFile))) {
				outputDir = Path.dirname(outputFile);
			} else {
				outputDir = Path.join(outputFile, name);
			}
		}
		// -----------------------------------------
		var t = "\t".repeat(this.params.indentation + 1),
			t2 = "\t".repeat(this.params.indentation);
		var contents = "\r\n" + t + Object.keys(this.outline).map(name => {
			var entry = this.outline[name];
			if (entry instanceof Bundler) {
				if (!outline.subtree) {
					outline.subtree = {};
				}
				outline.subtree[name] = {};
				return entry.output(outputDir, outline.subtree[name], name);
			}
			if (!outline.meta) {
				outline.meta = {};
			}
			outline.meta[name] = entry.meta;
			return _isFunction(entry.content) ? entry.content(outputDir) : entry.content;
		}).join("\r\n\r\n" + t) + "\r\n" + t2;
		// -----------------------------------------
		if (outputFileExt) {
			Fs.mkdirSync(outputDir, {recursive:true});
			Fs.writeFileSync(outputFile, contents);
			if (this.params.CREATE_OUTLINE_FILE) {
				var outlineFile = outputFile + '.json';
				if (Fs.existsSync(outlineFile) && this.params.CREATE_OUTLINE_FILE === 'create_merge') {
					outline = _merge(100, {}, JSON.parse(Fs.readFileSync(outlineFile)), outline);
				}
				Fs.writeFileSync(outlineFile, JSON.stringify(outline, null, 4));
			}
			src = getPublicFilename(outputFile, this.params.indentation);
		}
		// -----------------------------------------
		return `<template${
				((this.params.TEMPLATE_ELEMENT || '').trim() ? ' is="' + this.params.TEMPLATE_ELEMENT + '"' : '') + (name ? ' ' + this.params.TEMPLATE_NAME_ATTR + '="' + name + '"' : '') + (src ? ' src="' + src + '"' : '')
			}>${(!src ? contents : '')}</template>`;
	}	
}

/**
 * @var object
 */
Bundler.mime = {
	'.ico': 'image/x-icon',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.svg': 'image/svg+xml',
};

/**
 * @var function
 */
const getPublicFilename = (filename, indentation) => {
	return filename.replace(/\\/g, '/').split('/').slice(- (indentation + 1)).join('/');
};
