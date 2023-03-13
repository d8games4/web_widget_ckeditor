/*
    Copyright 2021 Camptocamp SA (https://www.camptocamp.com).
    @author Iván Todorovich <ivan.todorovich@camptocamp.com>
    License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
*/

odoo.define("web_widget_ckeditor.field_ckeditor", function (require) {
    "use strict";

    const core = require("web.core");
    const session = require("web.session");
    const config = require("web.config");
    const ajax = require("web.ajax");
    const rpc = require("web.rpc");
    const basic_fields = require("web.basic_fields");
    const field_registry = require("web.field_registry");
    const _lt = core._lt;
    const TranslatableFieldMixin = basic_fields.TranslatableFieldMixin;

    // Load configuration for the editor
    const getCKEditorConfigPromise = rpc.query({
        model: "ir.config_parameter",
        method: "get_web_widget_ckeditor_config",
    });

    // Load CKEditor localization files
    async function loadCKEditorLanguageSource(languageCode) {
        if (languageCode === "en") {
            return;
        }
        const languageURL = `/web_widget_ckeditor/static/lib/ckeditor/build/translations/${languageCode}.js`;
        try {
            ajax.loadJS(languageURL);
        } catch (error) {
            console.warn("Unable to load CKEditor language: ", languageCode);
        }
    }
    const CKEditorLanguageCode = session.user_context.lang.split("_")[0];
    const loadCKEditorLanguagePromise = loadCKEditorLanguageSource(
        CKEditorLanguageCode
    );

    const FieldHtmlCKEditor = basic_fields.DebouncedField.extend(
        TranslatableFieldMixin,
        {
            description: _lt("Html (CKEditor)"),
            className: "oe_form_field oe_form_field_html oe_form_field_html_ckeditor",
            supportedFieldTypes: ["html"],

            /**
             * @override
             */
            willStart: function () {
                return Promise.all([
                    this._super.apply(this, arguments),
                    loadCKEditorLanguagePromise,
                ]);
            },

            /**
             * @override
             */
            destroy: function () {
                if (this.ckeditor) {
                    this.ckeditor.destroy();
                    this.ckeditor = undefined;
                }
                return this._super();
            },

            // --------------------------------------------------------------------------
            // Public
            // --------------------------------------------------------------------------

            /**
             * @override
             */
            activate: function () {
                if (this.ckeditor) {
                    this.ckeditor.focus();
                    return true;
                }
            },
            /**
             * This function is similar to the one found in core's web_editor.FieldHtml.
             *
             * @override
             */
            isSet: function () {
                // Removing spaces & html spaces
                const value =
                    this.value &&
                    this.value.split("&nbsp;").join("").replace(/\s/g, "");
                return (
                    value &&
                    value !== "<p></p>" &&
                    value !== "<p><br></p>" &&
                    value.match(/\S/)
                );
            },
            /**
             * This function is similar to the one found in core's web_editor.FieldHtml.
             *
             * @override
             */
            getFocusableElement: function () {
                return this.$target || $();
            },
            /**
             * Do not re-render this field if it was the origin of the onchange call.
             * This function is similar to the one found in core's web_editor.FieldHtml.
             *
             * @override
             */
            reset: function (record, event) {
                this._reset(record, event);
                const value = this._textToHtml(this.value);
                if (!event || event.target !== this) {
                    if (this.mode === "edit") {
                        this.ckeditor.setData(value);
                    } else {
                        this.$content.html(value);
                    }
                }
                return Promise.resolve();
            },

            // --------------------------------------------------------------------------
            // Private
            // --------------------------------------------------------------------------

            /**
             * @override
             */
            _getValue: function () {
                if (this.mode === "edit" && this.ckeditor) {
                    return this.ckeditor.getData();
                }
                return this.$target.val();
            },
            /**
             * Gets the CKEditor toolbar items configuration.
             * If not found, returns the default configuration.
             */
            _getCKEditorToolbarItems: async function () {
                try {
                    const ckconfig = await getCKEditorConfigPromise;
                    if (ckconfig.toolbar) {
                        return ckconfig.toolbar.split(/[\s,]+/).filter((item) => item);
                    }
                } catch (error) {
                    console.warn(
                        "Unable to use CKEditor toolbar configuration: ",
                        error
                    );
                    console.warn(
                        "Please check the value for ir.config_parameter 'web_widget_ckeditor.toolbar' is correct"
                    );
                    console.warn("Using default toolbar configuration");
                }
                return [
                    'undo',
                    'redo',
                    'findAndReplace',
                    'pageBreak',
                    'restrictedEditingException',
                    '|',
                    'heading',
                    '|',
                    'style',
                    '|',
                    'textPartLanguage',
                    '|',
                    'fontFamily',
                    'fontSize',
                    'fontColor',
                    'fontBackgroundColor',
                    'highlight',
                    '|',
                    'bold',
                    'italic',
                    'underline',
                    'strikethrough',
                    'superscript',
                    'subscript',
                    'removeFormat',
                    '|',
                    'alignment',
                    'indent',
                    'outdent',
                    '|',
                    'bulletedList',
                    'numberedList',
                    'todoList',
                    '|',
                    'link',
                    'specialCharacters',
                    'blockQuote',
                    'insertTable',
                    'imageUpload',
                    'horizontalLine',
                    '|',
                    'code',
                    'codeBlock',
                    'htmlEmbed',
                    'mediaEmbed',
                ];
            },
            /**
             * Gets the CKEditor configuration.
             * See for details:
             * https://ckeditor.com/docs/ckeditor5/latest/api/module_core_editor_editorconfig-EditorConfig.html
             *
             * @returns EditorConfig
             */
            _getCKEditorConfig: async function () {
                const res = {
                    toolbar: {
                        items: await this._getCKEditorToolbarItems(),
                        shouldNotGroupWhenFull: true,
                    },
                    language: CKEditorLanguageCode,
                    image: {
                        toolbar: [
                            'imageTextAlternative',
                            'toggleImageCaption',
                            'imageStyle:inline',
                            'imageStyle:block',
                            'imageStyle:side',
                            'linkImage'
                        ],
                    },
                    table: {
                        contentToolbar: [
                            "tableColumn",
                            "tableRow",
                            "mergeTableCells",
                            "tableCellProperties",
                            "tableProperties",
                        ],
                    },
                    fontSize: {
                        options: [10, 12, 14, 18, 24, 30, 36, 48, 60, 72],
                    },
                    fontFamily: {
                        options: [
                            'Droid Arabic Kufi Bold',
                            'Droid Arabic Kufi',
                            'Amiri Quran',
                            'Aref Ruqaa Regula',
                            'Arial, Helvetica, sans-serif',
                            'Arvo',
                            'BFantezy',
                            'Courier New, Courier, monospace',
                            'ElMessiri',
                            'Georgia, serif',
                            'Lucida Sans Unicode, Lucida Grande, sans-serif',
                            'Noto Serif',
                            'Open Sans',
                            'Raleway',
                            'Roboto',
                            'Source Sans Pro',
                            'Sultan Bold',
                            'Ulamjad',
                            'Verdana, Geneva, sans-serif',
                        ]
                    },
                    fontColor: {
                        colors: [
                            {
                                color: 'hsl(0, 0%, 0%)',
                                label: 'Black'
                            },
                            {
                                color: 'hsl(0, 0%, 30%)',
                                label: 'Dim grey'
                            },
                            {
                                color: 'hsl(0, 0%, 60%)',
                                label: 'Grey'
                            },
                            {
                                color: 'hsl(0, 0%, 90%)',
                                label: 'Light grey'
                            },

                            {
                                color: 'hsl(0, 75%, 60%)',
                                label: 'Red'
                            },
                            {
                                color: 'hsl(30, 75%, 60%)',
                                label: 'Orange'
                            },
                            {
                                color: 'hsl(60, 75%, 60%)',
                                label: 'Yellow'
                            },
                            {
                                color: 'hsl(90, 75%, 60%)',
                                label: 'Light green'
                            },
                            {
                                color: 'hsl(120, 75%, 60%)',
                                label: 'Green'
                            },
                            {
                                color: 'hsl(150, 75%, 60%)',
                                label: 'Aquamarine'
                            },
                            {
                                color: 'hsl(180, 75%, 60%)',
                                label: 'Turquoise'
                            },
                            {
                                color: 'hsl(210, 75%, 60%)',
                                label: 'Light blue'
                            },
                            {
                                color: 'hsl(240, 75%, 60%)',
                                label: 'Blue'
                            },
                            {
                                color: 'hsl(270, 75%, 60%)',
                                label: 'Purple'
                            }
                        ]
                    },
                    fontBackgroundColor: {
                        colors: [
                            {
                                color: 'hsl(0, 0%, 0%)',
                                label: 'Black'
                            },
                            {
                                color: 'hsl(0, 0%, 30%)',
                                label: 'Dim grey'
                            },
                            {
                                color: 'hsl(0, 0%, 60%)',
                                label: 'Grey'
                            },
                            {
                                color: 'hsl(0, 0%, 90%)',
                                label: 'Light grey'
                            },
                            {
                                color: 'hsl(0, 0%, 100%)',
                                label: 'White',
                                hasBorder: true
                            },
                            {
                                color: 'hsl(0, 75%, 60%)',
                                label: 'Red'
                            },
                            {
                                color: 'hsl(30, 75%, 60%)',
                                label: 'Orange'
                            },
                            {
                                color: 'hsl(60, 75%, 60%)',
                                label: 'Yellow'
                            },
                            {
                                color: 'hsl(90, 75%, 60%)',
                                label: 'Light green'
                            },
                            {
                                color: 'hsl(120, 75%, 60%)',
                                label: 'Green'
                            },
                            {
                                color: 'hsl(150, 75%, 60%)',
                                label: 'Aquamarine'
                            },
                            {
                                color: 'hsl(180, 75%, 60%)',
                                label: 'Turquoise'
                            },
                            {
                                color: 'hsl(210, 75%, 60%)',
                                label: 'Light blue'
                            },
                            {
                                color: 'hsl(240, 75%, 60%)',
                                label: 'Blue'
                            },
                            {
                                color: 'hsl(270, 75%, 60%)',
                                label: 'Purple'
                            }
                        ]
                    },
                    heading: {
                        options: [
                            { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                            { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
                            { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
                            { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
                            { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
                            { model: 'heading5', view: 'h5', title: 'Heading 5', class: 'ck-heading_heading5' },
                            { model: 'heading6', view: 'h6', title: 'Heading 6', class: 'ck-heading_heading6' }
                        ],
                    },
                    style: {
                        definitions: [
                            {
                                name: 'Article category',
                                element: 'h3',
                                classes: ['category']
                            },
                            {
                                name: 'Title',
                                element: 'h2',
                                classes: ['document-title']
                            },
                            {
                                name: 'Subtitle',
                                element: 'h3',
                                classes: ['document-subtitle']
                            },
                            {
                                name: 'Info box',
                                element: 'p',
                                classes: ['info-box']
                            },
                            {
                                name: 'Side quote',
                                element: 'blockquote',
                                classes: ['side-quote']
                            },
                            {
                                name: 'Marker',
                                element: 'span',
                                classes: ['marker']
                            },
                            {
                                name: 'Spoiler',
                                element: 'span',
                                classes: ['spoiler']
                            },
                            {
                                name: 'Code (dark)',
                                element: 'pre',
                                classes: ['fancy-code', 'fancy-code-dark']
                            },
                            {
                                name: 'Code (bright)',
                                element: 'pre',
                                classes: ['fancy-code', 'fancy-code-bright']
                            }
                        ]
                    },
                };
                if (config.isDebug()) {
                    res.toolbar.items.push("sourceEditing");
                }
                return res;
            },
            /**
             * Create the CKEditor instance with the target (this.$target)
             * then add the editable content (this.$content).
             *
             * @private
             * @returns {$.Promise}
             */
            _createCKEditorIntance: async function () {
                const editorConfig = await this._getCKEditorConfig();
                this.ckeditor = await window.ClassicEditor.create(
                    this.$target.get(0),
                    editorConfig
                );
                // Register event hooks
                this.ckeditor.on("change", () => this._onChange());
                this.ckeditor.ui.focusTracker.on(
                    "change:isFocused",
                    (ev, name, isFocused) => (isFocused ? null : this._onChange())
                );
                this._onLoadCKEditor();
                // Enere didn't work whe build was upgraded - Ahmed Addawody -
                this.ckeditor.keystrokes.set( 'enter', 'enter' );
                this.ckeditor.keystrokes.set( 'Shift+enter', 'shiftEnter' );
            },
            /**
             * @override
             */
            _renderEdit: function () {
                const value = this._textToHtml(this.value);
                this.$target = $("<textarea>").val(value).hide();
                this.$target.appendTo(this.$el);
                return this._createCKEditorIntance();
            },
            /**
             * @override
             */
            _renderReadonly: function () {
                const value = this._textToHtml(this.value);
                this.$el.empty();
                this.$content = $('<div class="o_readonly"/>').html(value);
                this.$content.appendTo(this.$el);
            },
            /**
             * This function is similar to the one found in core's web_editor.FieldHtml.
             *
             * @private
             * @param {String} text
             * @returns {String} the text converted to html
             */
            _textToHtml: function (text) {
                let value = text || "";
                try {
                    // Crashes if text isn't html
                    $(text)[0].innerHTML; // eslint-disable-line
                } catch (e) {
                    if (value.match(/^\s*$/)) {
                        value = "<p><br/></p>";
                    } else {
                        value =
                            "<p>" +
                            value.split(/<br\/?>/).join("<br/></p><p>") +
                            "</p>";
                        value = value
                            .replace(/<p><\/p>/g, "")
                            .replace("<p><p>", "<p>")
                            .replace("<p><p ", "<p ")
                            .replace("</p></p>", "</p>");
                    }
                }
                return value;
            },

            // --------------------------------------------------------------------------
            // Handler
            // --------------------------------------------------------------------------

            /**
             * Method called when the CKEditor instance is loaded.
             *
             * @private
             */
            _onLoadCKEditor: function () {
                const $button = this._renderTranslateButton();
                $button.css({
                    "font-size": "15px",
                    position: "absolute",
                    right: "+5px",
                    top: "+5px",
                });
                this.$el.append($button);
            },
            /**
             * Method called when ckeditor triggers a change.
             *
             * @private
             * @param {OdooEvent} ev
             */
            _onChange: function () {
                this._doDebouncedAction.apply(this, arguments);
            },
        }
    );

    field_registry.add("ckeditor", FieldHtmlCKEditor);

    return FieldHtmlCKEditor;
});