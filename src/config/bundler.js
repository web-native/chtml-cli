
/**
 * imports
 */
import Path from 'path';
import _merge from '@webqit/util/obj/merge.js';
import { initialGetIndex } from '@webqit/backpack/src/cli/Promptx.js';
import * as DotJson from '@webqit/backpack/src/dotfiles/DotJson.js';

/**
 * Reads BUNDLING from file.
 * 
 * @param object    flags
 * @param object    params
 * 
 * @return object
 */
export async function read(flags = {}, params = {}) {
    const config = DotJson.read(Path.join(params.ROOT || '', './.webqit/oohtml-cli/config/bundler.json'));
    return _merge({
        ENTRY_DIR: './',
        OUTPUT_FILE: './bundle.html',
        EXPLODE_ENTRY_DIR: false,
        LOADERS: [],
        // ---------
        // Advanced
        // ---------
        IGNORE_FOLDERS_BY_PREFIX: ['.'],
        CREATE_OUTLINE_FILE: 'create',
        TEMPLATE_ELEMENT: '',
        TEMPLATE_NAME_ATTR: 'name',
        EXPORT_MODE: 'attribute',
        EXPORT_GROUP_ATTR: 'exportgroup',
        EXPORT_ELEMENT: 'html-export',
        EXPORT_ID_ATTR: 'export',
        MAX_DATA_URL_SIZE: 1024,
        ASSETS_PUBLIC_BASE: '/',
    }, config);
};

/**
 * Writes BUNDLING to file.
 * 
 * @param object    data
 * @param object    flags
 * @param object    params
 * 
 * @return void
 */
export async function write(data, flags = {}, params = {}) {
    DotJson.write(data, Path.join(params.ROOT || '', './.webqit/oohtml-cli/config/bundler.json'));
};

/**
 * Configures BUNDLING.
 * 
 * @param object    config
 * @param object    choices
 * @param object    params
 * 
 * @return Array
 */
export async function questions(config, choices = {}, params = {}) {

    // Params
    const DATA = config;

    // Choices hash...
    const CHOICES = _merge({
        export_mode: [
            {value: 'attribute', title: 'Use the "exportgroup" attribute'},
            {value: 'element', title: 'Use the "export" element'},
        ],
        create_outline_file: [
            {value: '', title: 'No outline'},
            {value: 'create', title: 'Create'},
            {value: 'create_merge', title: 'Create and merge'},
        ],
    }, choices);

    // Questions
    return [
        {
            name: 'ENTRY_DIR',
            type: 'text',
            message: 'Enter the entry directory',
            initial: DATA.ENTRY_DIR,
            validation: ['important'],
        },
        {
            name: 'OUTPUT_FILE',
            type: 'text',
            message: 'Enter the output file name',
            initial: DATA.OUTPUT_FILE,
            validation: ['important'],
        },
        {
            name: 'EXPLODE_ENTRY_DIR',
            type: 'toggle',
            message: 'Multiply the entry directory above',
            active: 'YES',
            inactive: 'NO',
            initial: DATA.EXPLODE_ENTRY_DIR,
        },
        {
            name: 'LOADERS',
            type: 'recursive',
            initial: DATA.LOADERS,
            controls: {
                name: 'loader',
            },
            questions: [
                {
                    name: 'name',
                    type: 'text',
                    message: 'Enter loader name',
                    validation: ['important'],
                },
                {
                    name: 'args',
                    type: 'recursive',
                    controls: {
                        name: 'argument/flag',
                        combomode: true,
                    },
                    questions: [
                        {
                            name: 'name',
                            type: 'text',
                            message: 'Enter argument/flag name',
                            validation: ['important'],
                        },
                        {
                            name: 'value',
                            type: 'text',
                            message: 'Enter argument/flag value',
                            validation: ['important'],
                        },
                    ]
                },
            ]
        },
        // ---------
        // Advanced
        // ---------
        {
            name: '__advanced',
            type: 'toggle',
            message: 'Show advanced options?',
            active: 'YES',
            inactive: 'NO',
            initial: DATA.__advanced,
        },
        {
            name: 'IGNORE_FOLDERS_BY_PREFIX',
            type: (prev, answers) => answers.__advanced ? 'list' : null,
            message: 'List folders to ignore by prefix (comma-separated)',
            initial: (DATA.IGNORE_FOLDERS_BY_PREFIX || []).join(', '),
        },
        {
            name: 'CREATE_OUTLINE_FILE',
            type: (prev, answers) => answers.__advanced ? 'select' : null,
            message: 'Choose whether to create an outline file',
            choices: CHOICES.create_outline_file,
            initial: initialGetIndex(CHOICES.create_outline_file, DATA.CREATE_OUTLINE_FILE),
        },
        {
            name: 'TEMPLATE_ELEMENT',
            type: (prev, answers) => answers.__advanced ? 'text' : null,
            message: 'Enter the "template" custom element name (e.g: html-module or leave empty)',
            initial: DATA.TEMPLATE_ELEMENT,
        },
        {
            name: 'TEMPLATE_NAME_ATTR',
            type: (prev, answers) => answers.__advanced ? 'text' : null,
            message: 'Enter the template element\'s "name" attribute (e.g: name)',
            initial: DATA.TEMPLATE_NAME_ATTR,
            validation:['important'],
        },
        {
            name: 'EXPORT_MODE',
            type: (prev, answers) => answers.__advanced ? 'select' : null,
            message: 'Choose how to export snippets',
            choices: CHOICES.export_mode,
            initial: initialGetIndex(CHOICES.export_mode, DATA.EXPORT_MODE),
        },
        {
            name: 'EXPORT_GROUP_ATTR',
            type: (prev, answers) => answers.__advanced && answers.EXPORT_MODE === 'attribute' ? 'text' : null,
            message: 'Enter the "export group" attribute (e.g: exportgroup)',
            initial: DATA.EXPORT_GROUP_ATTR,
            validation: ['important'],
        },
        {
            name: 'EXPORT_ELEMENT',
            type: (prev, answers) => answers.__advanced && answers.EXPORT_MODE === 'element' ? 'text' : null,
            message: 'Enter the "export" element (e.g: html-export)',
            initial: DATA.EXPORT_ELEMENT,
            validation: ['important'],
        },
        {
            name: 'EXPORT_ID_ATTR',
            type: (prev, answers) => answers.__advanced && answers.EXPORT_MODE === 'element' ? 'text' : null,
            message: 'Enter the export element\'s "name" attribute (e.g: name)',
            initial: DATA.EXPORT_ID_ATTR,
            validation: ['important'],
        },
        {
            name: 'MAX_DATA_URL_SIZE',
            type: (prev, answers) => answers.__advanced ? 'number' : null,
            message: 'Enter the data-URL threshold for media files',
            initial: DATA.MAX_DATA_URL_SIZE,
            validation: ['important'],
        },
        {
            name: 'ASSETS_PUBLIC_BASE',
            type: (prev, answers) => answers.__advanced ? 'text' : null,
            message: 'Enter the public base for assets',
            initial: DATA.ASSETS_PUBLIC_BASE,
        },
    ];
};
