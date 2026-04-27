# Doc Comment 瀹¤ Checklist

**鐢ㄩ€?*锛氫緵 code-reviewer銆乤udit-prompts銆佷汉宸ュ璁″紩鐢ㄣ€傜敤浜庨獙璇佸鍑虹鍙风殑 JSDoc 瀹屾暣鎬с€?
---

## 搂1 閫傜敤鑼冨洿

- `packages/bmad-speckit/src/**/*.js`
- `scoring/**/*.ts`
- `scripts/**/*.ts`

鎺掗櫎锛歚**/__tests__/**`銆乣**/*.test.js`銆乣**/*.test.ts`銆?
---

## 搂2 蹇呭～椤?
| 绗﹀彿绫诲瀷 | 蹇呭～ tag | 璇存槑 |
|----------|----------|------|
| 瀵煎嚭鍑芥暟 | @description | 鍑芥暟鐢ㄩ€旇鏄?|
| 鏈夊弬鏁?| @param {Type} name - 璇存槑 | 鍚被鍨嬩笌璇存槑 |
| 鏈夎繑鍥炲€?| @returns {Type} 璇存槑 | 鍚被鍨嬩笌璇存槑 |
| 鏃犺繑鍥炲€硷紙void锛?| @description | 涓嶈姹?@returns |
| 瀵煎嚭绫?| @description | 绫昏亴璐ｈ鏄庯紱鍏?public 鏂规硶鎸夊嚱鏁拌鍒?|
| 瀵煎嚭甯搁噺 | @description | 甯搁噺鍚箟 |

---

## 搂3 楠屾敹鏂瑰紡

```bash
npm run lint
```

楠屾敹閫氳繃鏉′欢锛歚npm run lint` 鏃犻敊璇€佹棤璀﹀憡锛堥拡瀵逛笂杩伴€傜敤鑼冨洿鍐呯殑鏂囦欢锛夈€?
---

## 搂4 鍙傝€?
- 澶氳瑷€ doc 瑙勮寖涓庡繀濉?tag 瀵圭収锛歔doc-comment-standards-by-language.md](./doc-comment-standards-by-language.md)

---

*鏈?checklist 涓?ESLint jsdoc 瑙勫垯涓€鑷达紱瀹¤鏃堕』鎵ц楠屾敹鍛戒护楠岃瘉銆?
