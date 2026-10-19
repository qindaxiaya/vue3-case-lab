// ESLint 扁平配置：Vue 3 + TypeScript 严格规则
// 命令：npm run lint
import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 忽略构建产物与本地临时目录
  { ignores: ['dist/**', 'node_modules/**', '.local/**'] },

  // JS/TS 基础规则
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Vue 单文件组件规则（启用推荐集）
  ...pluginVue.configs['flat/recommended'],

  // Vue 文件解析器与类型感知设置
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // 全局环境：浏览器 + ES 模块
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
  },

  // 项目自定义规则
  {
    rules: {
      // Vue 模板属性必须 kebab-case（与 HTML 属性习惯一致）
      'vue/multi-word-component-names': 'off',
      // 允许 console（教学演示需要展示日志）
      'no-console': 'off',
      // 未使用变量：仅对参数用 _ 前缀放行
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 禁 any 改用 unknown（TS strict 项目约定）
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
)
