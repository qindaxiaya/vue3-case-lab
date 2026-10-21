// ============================================================
// 浏览记录与收藏（私人速查站的高频操作）
// - 「最近浏览」自动记录最近打开过的 8 个案例
// - 「收藏」由用户手动点星，列表页可只看收藏
// - 持久化到 localStorage；隐私模式/存储被禁用时静默降级为内存态
// - 纯列表操作抽成 pushRecent / toggleFavorite，便于单测
// ============================================================
import { readonly, ref } from 'vue'

/** localStorage 键名（与主题键 moyu-theme 同一前缀，便于排查） */
const FAVORITE_KEY = 'moyu-favorites'
const RECENT_KEY = 'moyu-recent'

/** 最近浏览最多保留条数：太多会挤占列表页首屏 */
export const RECENT_LIMIT = 8

/** 案例唯一键：分类 + 案例（避免不同分类同名案例互相覆盖） */
export function caseKey(categoryId: string, caseId: string): string {
  return `${categoryId}/${caseId}`
}

/** 拆回分类与案例（存储里只有字符串键） */
export function parseCaseKey(key: string): [string, string] | null {
  const [categoryId, caseId] = key.split('/')
  return categoryId && caseId ? [categoryId, caseId] : null
}

/**
 * 把案例放到最近列表最前面（已存在则提升，不产生重复）
 * @returns 新数组，不修改入参
 */
export function pushRecent(
  list: readonly string[],
  key: string,
  limit = RECENT_LIMIT,
): string[] {
  return [key, ...list.filter((item) => item !== key)].slice(0, limit)
}

/**
 * 切换收藏状态
 * @returns 新数组，不修改入参
 */
export function toggleFavorite(list: readonly string[], key: string): string[] {
  return list.includes(key)
    ? list.filter((item) => item !== key)
    : [...list, key]
}

/** 安全读取字符串数组：解析失败/无 localStorage 时返回空数组 */
function readList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    // 只接受字符串数组，避免脏数据把页面渲染搞崩
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

/** 安全写入：配额满或被浏览器禁用时不抛错 */
function writeList(key: string, list: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // 隐私模式下降级为内存态：本次会话仍可用，刷新后丢失
  }
}

// 模块级单例：多个页面共用同一份状态
const favorites = ref<string[]>(readList(FAVORITE_KEY))
const recent = ref<string[]>(readList(RECENT_KEY))

/**
 * 浏览记录 / 收藏 composable
 * @returns 只读列表 + 记录/收藏操作
 *          （返回类型交给 TS 推导：readonly(ref) 的只读包装类型很啰嗦，写死反而容易失配）
 */
export function useCaseHistory() {
  return {
    favorites: readonly(favorites),
    recent: readonly(recent),
    isFavorite: (key: string) => favorites.value.includes(key),
    toggleFavorite: (key: string) => {
      favorites.value = toggleFavorite(favorites.value, key)
      writeList(FAVORITE_KEY, favorites.value)
    },
    recordVisit: (key: string) => {
      const next = pushRecent(recent.value, key)
      // 已经在第一位就不写存储，避免每次进入同一案例都触发一次 IO
      if (next[0] === recent.value[0] && next.length === recent.value.length) return
      recent.value = next
      writeList(RECENT_KEY, next)
    },
  }
}
