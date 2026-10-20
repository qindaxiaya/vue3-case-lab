// 应用入口：Element Plus 主题 → 站点样式 → 挂载路由 → 创建并挂载根组件
// Element Plus 只用于 Demo 通用表单控件，不做整包注册（组件由 unplugin 按需引入）
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './style.scss'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

// 创建应用实例，注册路由后挂载到 #app 容器
createApp(App).use(router).mount('#app')
