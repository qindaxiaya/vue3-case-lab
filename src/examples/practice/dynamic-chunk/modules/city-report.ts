// ============================================================
// 报表模块：按国家聚合城市人口并排序
// - 它静态引用 city-data（数据文件），所以下载本模块会连带下载数据
// - 这正是「按需加载」要量清楚的东西：一次 import 实际带走多少字节
// ============================================================
import { CITIES, type CityRow } from './city-data'

/** 一个国家的人口汇总 */
export interface CountryStat {
  country: string
  cities: number
  population: number
}

/** 报表结果 */
export interface ReportResult {
  /** 国家维度汇总（人口降序） */
  countries: CountryStat[]
  /** 人口最多的 5 个城市 */
  topCities: CityRow[]
  /** 参与统计的城市总数 */
  totalCities: number
}

/**
 * 生成报表
 * 用 Map 累加，避免 O(n²) 的 find；80 条数据虽然小，但写法要经得起放大
 */
export function buildReport(): ReportResult {
  const byCountry = new Map<string, CountryStat>()

  for (const row of CITIES) {
    const [, country, , , population] = row
    const stat = byCountry.get(country)
    if (stat) {
      stat.cities += 1
      stat.population += population
    } else {
      byCountry.set(country, { country, cities: 1, population })
    }
  }

  const countries = [...byCountry.values()].sort(
    (a, b) => b.population - a.population,
  )

  // 复制后排序：不要就地改 CITIES，避免影响其他模块的数据
  const topCities = [...CITIES]
    .sort((a, b) => b[4] - a[4])
    .slice(0, 5)

  return { countries, topCities, totalCities: CITIES.length }
}
