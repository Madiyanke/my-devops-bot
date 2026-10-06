import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import parser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

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
                process: 'readonly',
                navigator: 'readonly',
                crypto: 'readonly',
                fetch: 'readonly',
                Response: 'readonly',
                TextDecoder: 'readonly',
                AbortController: 'readonly',
                DOMException: 'readonly',
                NodeFilter: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly'
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
        // TypeScript : la règle JS ne comprend pas les signatures de types
        files: ['**/*.ts', '**/*.vue'],
        plugins: { '@typescript-eslint': tsPlugin },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
        }
    },
    {
        ignores: ['dist/', 'node_modules/', 'coverage/', '*.config.js']
    }
]
