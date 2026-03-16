/**
 * 字符串工具模块
 * 提供 camelCase、kebabCase、truncate、isEmpty 等常用字符串处理函数
 */

/**
 * 将字符串转换为 camelCase
 * @param str - 输入字符串
 * @returns camelCase 格式的字符串
 * @example camelCase("hello world") => "helloWorld"
 * @example camelCase("hello-world") => "helloWorld"
 * @example camelCase("hello_world") => "helloWorld"
 */
export function camelCase(str: string): string {
  if (!str) return '';

  // 如果已经是 camelCase 格式（没有分隔符且中间有大写字母），直接返回小写首字母版本
  if (!/[-_\s]/.test(str) && /[a-z][A-Z]/.test(str)) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  return str
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

/**
 * 将字符串转换为 kebab-case
 * @param str - 输入字符串
 * @returns kebab-case 格式的字符串
 * @example kebabCase("hello world") => "hello-world"
 * @example kebabCase("helloWorld") => "hello-world"
 * @example kebabCase("Hello World") => "hello-world"
 */
export function kebabCase(str: string): string {
  if (!str) return '';

  return str
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * 截断字符串，超过指定长度时添加省略号
 * @param str - 输入字符串
 * @param length - 最大长度
 * @returns 截断后的字符串
 * @example truncate("hello world", 5) => "he..."
 * @example truncate("hello", 10) => "hello"
 */
export function truncate(str: string, length: number): string {
  if (!str || length < 0) return str;
  if (str.length <= length) return str;
  if (length <= 3) return '...';

  return str.slice(0, length - 3) + '...';
}

/**
 * 检查字符串是否为空（null、undefined、空字符串或仅空白字符）
 * @param str - 输入字符串
 * @returns 是否为空
 * @example isEmpty("") => true
 * @example isEmpty("  ") => true
 * @example isEmpty("hello") => false
 */
export function isEmpty(str: string | null | undefined): boolean {
  if (str === null || str === undefined) return true;
  return str.trim().length === 0;
}
