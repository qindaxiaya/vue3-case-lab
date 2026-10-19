// 应用入口：全局样式最先引入 → 创建并挂载根组件
import './style.scss'
import { createApp } from 'vue'
import App from './App.vue'

// 创建应用实例并挂载到 index.html 的 #app 容器
createApp(App).mount('#app')
