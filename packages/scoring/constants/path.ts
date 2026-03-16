import path from 'path';

/**
 * 获取评分数据存储路径。
 * 默认 scoring/data/，可通过环境变量 SCORING_DATA_PATH 覆盖为 _bmad-output/scoring/ 等。
 * @returns {string} 评分数据目录的绝对路径
 */
export function getScoringDataPath(): string {
  const envPath = process.env.SCORING_DATA_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
  }
  return path.resolve(process.cwd(), 'packages', 'scoring', 'data');
}
