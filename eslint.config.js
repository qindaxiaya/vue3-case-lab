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
      // 关闭 v-html XSS 告警：项目约定 v-html 仅渲染 meta.ts 本地受信内容，
      // 不存在用户输入流入（见 CaseNotes.vue 注释）
      'vue/no-v-html': 'off',
      // TS 项目标准做法：关闭 no-undef（类型未定义由 vue-tsc 检查，
      // eslint 的 no-undef 会把 TS 类型名如 PerformanceObserverInit 误报为未定义）
      'no-undef': 'off',
    },
  },
)
