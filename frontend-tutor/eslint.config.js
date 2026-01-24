import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'

export default [
    js.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.vue', '**/*.js', '**/*.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
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
            'no-unused-vars': 'warn',
            'no-console': 'off'
        }
    },
    {
        ignores: ['dist/', 'node_modules/', '*.config.js']
    }
]
