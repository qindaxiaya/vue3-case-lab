// 应用入口：全局样式最先引入 → 挂载路由 → 创建并挂载根组件
import './style.scss'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

// 创建应用实例，注册路由后挂载到 #app 容器
createApp(App).use(router).mount('#app')
