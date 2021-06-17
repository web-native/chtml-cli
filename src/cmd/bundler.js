
/**
 * imports
 */
import Fs from 'fs';
import Url from 'url';
import Path from 'path';
import Bundler from '../modules/bundler/Bundler.js';
import _isString from '@webqit/util/js/isString.js';
import _isObject from '@webqit/util/js/isObject.js';
import _isEmpty from '@webqit/util/js/isEmpty.js';
import * as bundler from '../config/bundler.js'

/**
 * @description
 */
export const desc = {
    bundle: 'Creates the "partials" bundles.',
};

/**
 * @build
 */
export async function bundle(Ui, flags = {}, params = {}) {
	const config = await bundler.read(params);
    Ui.title(`${'Creating HTML bundles'} ...`);
    Ui.info('');
    Ui.info(Ui.f`FROM: ${config.ENTRY_DIR}`);
    Ui.info(Ui.f`TO: ${config.OUTPUT_FILE}`);
    Ui.info('');

	if (config.LOADERS) {
		if (typeof config.LOADERS === 'string') {
			config.LOADERS = config.LOADERS.split(',');
		}
		const LOADERS = config.LOADERS;
		config.LOADERS = [];
		const resolveLoaders = async loader => {
			if (!(loader = LOADERS.shift())) {
				return;
			}
			if (_isString(loader)) {
				loader = {name: loader.trim()};
			}
			if (_isObject(loader) && loader.name) {
				var loaderName = loader.name, isDefault;
				if (loaderName.startsWith('default:')) {
					isDefault = true;
					loaderName = loaderName.replace('default:', '');
				}
				// ---------------
				var loaderUrl = loaderName;
				if (isDefault) {
					loaderUrl = Path.join(Path.dirname(import.meta.url), '/../modules/bundler/loaders', loaderName + '.js');
				}
				var imported;
				if (Fs.existsSync(Url.fileURLToPath(loaderUrl)) && (imported = await import(loaderUrl)) && imported.default) {
					loader.load = imported.default;
				} else {
					throw new Error('Loader "' + loaderName + '" not found at ' + loaderUrl);
				}
			}
			config.LOADERS.push(loader);
			resolveLoaders();
		};
		await resolveLoaders();
	}
		
	var waiting, total = 0;
	if (!config.loadStart) {
		config.loadStart = (resource, params) => {
			var outputFile = params.OUTPUT_FILE;
			if (!Path.isAbsolute(outputFile)) {
				outputFile = Path.resolve(params.ENTRY_DIR, outputFile);
			}
			if (Path.resolve(resource) === outputFile) {
				return false;
			}
			if (waiting) {
				waiting.stop(); waiting = null;
			}
			waiting = Ui.waiting(Ui.f`${'Evaluating'} - ${resource}`);
			waiting.start();
		};
	}
	if (!config.loadEnd) {
		config.loadEnd = (resource, params, content, errors, meta) => {
			if (waiting) {
				waiting.stop(); waiting = null;
			}
			if (!_isEmpty(errors)) {
				Ui.error(Ui.f`Error - ${resource}:`);
				Object.keys(errors).forEach(src => {
					Ui.info(Ui.f`  [${src}] ${Ui.style.err(errors[src])}`);
				});
			} else {
				if (content) {
                    Ui.error(Ui.f`Loaded - ${resource}:`);
					total ++;
				}
			}
			
		};
	}

	// -------------------------------
	var ENTRY_DIR = config.ENTRY_DIR;
	if (config.EXPLODE_ENTRY_DIR) {
		if (Path.isAbsolute(config.OUTPUT_FILE) && !config.OUTPUT_FILE.matches(/\[name\]/)) {
			throw new Error('OUTPUT_FILE format must be in template format; must contain a [name] placeholder.');
		}
		ENTRY_DIR = {};
		Fs.readdirSync(config.ENTRY_DIR).forEach(name => {
			var resource = Path.join(config.ENTRY_DIR, name);
			if (Fs.statSync(resource).isDirectory() && !(config.IGNORE_FOLDERS_BY_PREFIX || []).filter(prfx => resource.substr(0, prfx.length) === prfx).length) {
				ENTRY_DIR[name] = resource;
			}
		});
	}
	await Bundler.bundle(ENTRY_DIR, config.OUTPUT_FILE, config);
	// -------------------------------

	Ui.info('');
    Ui.info(Ui.f`${total} total files bundled.`);
};