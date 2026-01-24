import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import parser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'

export default [
    js.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.vue', '**/*.js', '**/*.ts'],
        languageOptions: {
            parser: parser,
            parserOptions: {
                parser: tsParser,
                ecmaVersion: 'latest',
                sourceType: 'module'
            },
            globals: {
                defineProps: 'readonly',
                defineEmits: 'readonly',
                defineExpose: 'readonly',
                withDefaults: 'readonly',
                console: 'readonly',
                window: 'readonly',
                document: 'readonly',
                process: 'readonly'
            }
        },
        rules: {
            'vue/multi-word-component-names': 'off',
            'vue/max-attributes-per-line': 'off',
            'vue/singleline-html-element-content-newline': 'off',
            'vue/html-self-closing': 'off',
            'vue/html-closing-bracket-newline': 'off',
            'vue/html-indent': 'off',
            'vue/attributes-order': 'off',
            'vue/no-v-html': 'off',
            'no-unused-vars': 'warn',
            'no-console': 'off'
        }
    },
    {
        ignores: ['dist/', 'node_modules/', 'coverage/', '*.config.js']
    }
]
