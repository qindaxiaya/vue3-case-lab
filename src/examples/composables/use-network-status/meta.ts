// ============================================================
// 案例元数据：useNetworkStatus 网络状态
// ============================================================
import type { CaseMeta } from '../../../types/case'

export default {
  id: 'use-network-status',
  title: 'useNetworkStatus：在线状态要订阅全',
  difficulty: 'intermediate',
  tags: ['组合式函数', '网络状态', '事件监听', '连接信息'],
  summary: '只监听 online/offline 会漏掉制式变化，封装统一订阅',
  sell: '网络状态不只在线离线，还要订阅连接变化',
  explain: {
    situation:
      '页面只监听了 online / offline，用户从 4G 切到 3G 时状态栏还显示 4G；换一个页面又要重新写一遍监听和清理。',
    background:
      'navigator.onLine 只表示「有没有网」，网速、延迟、省流模式在 navigator.connection 里。online / offline 事件不会在制式变化时触发，必须再订阅 connection 的 change 事件。',
    action:
      '案例把网络状态封装成 useNetworkStatus(source)：启动时同步读一次快照，订阅 online / offline 和 connection.change，变化时整块更新；卸载或 effectScope.stop() 时自动解绑。',
    conclusion:
      '记住：网络状态是一组字段，不是单个布尔值；监听要覆盖 online / offline 和 connection.change 两类事件，并且只注册一次、统一清理。',
  },
} satisfies CaseMeta
