# Doc Comment Standards by Language

**鐢ㄩ€?*锛氬璇█ doc 娉ㄩ噴瑙勮寖鍙傝€冦€佸繀濉?tag 瀵圭収銆佽嚜鍔ㄥ寲宸ュ叿銆佽鐩栫巼宸ュ叿銆備緵 BMAD 瀹¤娴佺▼銆乧ode-reviewer銆乤udit-prompts 寮曠敤銆?
---

## 1. 澶氳瑷€ doc 瑙勮寖瀵圭収琛?
| 璇█ | doc 瑙勮寖 | 蹇呭～ tag/瀛楁 | 鑷姩鍖栧伐鍏?| 瑕嗙洊鐜囧伐鍏?|
|------|----------|---------------|------------|------------|
| JavaScript/TypeScript | JSDoc | @description, @param, @returns锛堝惈绫诲瀷锛?| eslint-plugin-jsdoc | 鑷畾涔夎В鏋?export |
| Python | docstring (Google/NumPy/Sphinx) | 棣栬鎽樿銆丄rgs/Returns/Raises | pydocstyle銆乮nterrogate | interrogate |
| Java | Javadoc | @param銆丂return銆丂throws | javadoc銆乨etekt | 鑷畾涔?|
| Kotlin | KDoc | @param銆丂return銆丂throws | detekt | 鑷畾涔?|
| Go | godoc | 鍖呮敞閲娿€佸鍑哄悕娉ㄩ噴 | golint銆乻taticcheck | 鑷畾涔?|
| Rust | rustdoc | /// 鏂囨。銆? Examples | clippy銆乧argo doc | cargo doc |
| C# | XML 鏂囨。娉ㄩ噴 | \<summary\>銆乗<param\>銆乗<returns\> | StyleCop銆丷oslyn | 鑷畾涔?|
| Swift | 鏂囨。娉ㄩ噴 | 棣栬銆丳arameters銆丷eturns | SwiftLint | 鑷畾涔?|
| C/C++ | Doxygen | @brief銆丂param銆丂return | Doxygen銆乧lang-tidy | 鑷畾涔?|
| Ruby | RDoc/YARD | 棣栬銆丂param銆丂return | RuboCop銆乊ARD | 鑷畾涔?|
| PHP | phpDocumentor | @param銆丂return銆丂throws | phpcs銆乸hpDocumentor | 鑷畾涔?|
| Scala | ScalaDoc | @param銆丂return銆丂throws | Scalastyle銆乻bt-doc | 鑷畾涔?|

---

## 2. 瀵煎嚭绗﹀彿瀹氫箟锛堟寜璇█锛?
| 璇█ | 瀵煎嚭绗﹀彿瀹氫箟 |
|------|--------------|
| JavaScript | `export` 鎴?`module.exports` 鐨勫嚱鏁般€佺被銆佸父閲?|
| TypeScript | `export` 鐨勫嚱鏁般€佺被銆佹帴鍙ｃ€佺被鍨嬪埆鍚嶃€佸父閲?|
| Python | `__all__` 涓殑鍚嶅瓧锛屾垨妯″潡椤跺眰鍏紑鐨?`def`/`class` |
| Java/Kotlin | `public` 涓旈潪鍐呴儴绫?鎺ュ彛 |
| Go | 棣栧瓧姣嶅ぇ鍐欑殑鏍囪瘑绗?|
| Rust | `pub` 椤?|
| C# | `public`銆乣internal`锛堣椤圭洰锛?|
| Swift | `public`銆乣internal`锛堣椤圭洰锛?|
| C/C++ | 澶存枃浠朵腑鐨勫０鏄?|
| Ruby | 椤跺眰 `def`銆乣class`銆乣module` |
| PHP | `public` 鏂规硶銆佺被 |
| Scala | `public` 鎴栨湭鏍囨敞璁块棶绾у埆鐨勬垚鍛?|

---

## 3. 鏈」鐩紙JS/TS锛夊璁℃爣鍑?
### 3.1 閫傜敤鑼冨洿

- `packages/bmad-speckit/src/**/*.js`
- `scoring/**/*.ts`
- `scripts/**/*.ts`

鎺掗櫎锛歚**/__tests__/**`銆乣**/*.test.js`銆乣**/*.test.ts`銆?
### 3.2 蹇呭～ tag

| 鍦烘櫙 | 蹇呭～ tag | 璇存槑 |
|------|----------|------|
| 瀵煎嚭鍑芥暟/鏂规硶 | @description | 鍑芥暟鐢ㄩ€旇鏄?|
| 鏈夊弬鏁?| @param {Type} name - 璇存槑 | 鍚被鍨嬩笌璇存槑 |
| 鏈夎繑鍥炲€?| @returns {Type} 璇存槑 | 鍚被鍨嬩笌璇存槑 |
| 鏃犺繑鍥炲€硷紙void锛?| @description | 涓嶈姹?@returns |
| 瀵煎嚭绫?| @description | 绫昏亴璐ｈ鏄?|
| 瀵煎嚭甯搁噺 | @description | 甯搁噺鍚箟 |

涓嶅己鍒讹細@example銆丂throws锛堣嫢鏈?throw 鍙汉宸ユ鏌ワ級銆?
### 3.3 ESLint 瑙勫垯锛堜笌 T002 涓€鑷达級

```
jsdoc/require-description: error
jsdoc/require-param: error
jsdoc/require-param-description: warn
jsdoc/require-param-type: error
jsdoc/require-returns: error
jsdoc/require-returns-description: warn
jsdoc/require-returns-type: error
```

### 3.4 楠屾敹鍛戒护

```bash
npm run lint
```

---

*鏈〃鐢?BMAD Party-Mode 100 杞璁烘敹鏁涳紝鎵瑰垽鎬у璁″憳缁堝鍚屾剰銆?
