# dsh-stl-preview

在 DeepSeek Harness 的右侧栏文档预览里直接打开 **STL** 网格：可旋转缩放的 3D 视口，加上 3D 打印最关心的几个数——尺寸、体积、表面积、是否水密。

![右侧栏里的 STL 预览](https://raw.githubusercontent.com/439436269-ctrl/dsh-stl-preview/main/docs/stl-preview.png)

## 它做什么

- 给 `.stl` 注册文档预览渲染器：在工作区文件树点一下，右侧栏打开 3D 预览。
- 通过带鉴权的 `/api/stl-preview` 路由取字节，**在浏览器里解析二进制/ASCII STL**——不上传、不在 Host 转换。
- 用与 `dsh-blend-preview` 同一套零依赖 WebGL 查看器绘制：拖动旋转、右键平移、滚轮缩放、双击复位、线框、自动旋转、接触阴影、坐标轴。STL 是 Z-up，绘制前旋转到 Y-up 视口。
- 面板给出：格式（二进制/ASCII + 头信息）、文件大小、三角面、焊接后顶点数、mm 包围盒、体积 cm³、表面积 cm²，以及**水密性**（边界边/非流形边/退化面；按网格焊接顶点后统计每条边被几个面使用）。
- STL 无单位；`unitScale` 可配（1 = 毫米，10 = 厘米，25.4 = 英寸）。

## 依赖

- DeepSeek Harness 0.2.x（声明兼容 `0.2.0-rc.2` / `0.2.1-rc.2`）。
- 浏览器/显卡支持 WebGL。不需要 Blender、切片器或联网。

## 安装

```sh
dsh plugin --profile <profile> add dsh-stl-preview
```

桌面版（desktop profile）由 Electron 应用管理，用设置页的插件管理器安装，或手工装入后重启应用。包内自带 `cordis.patch.yml`，装好即自动挂载。

## 配置

设置 → 插件 → **STL preview**（命名空间 `stl-preview`）：

| 键 | 默认 | 含义 |
|---|---|---|
| `enabled` | `true` | 是否注册渲染器与字节路由。 |
| `routePath` | `/api/stl-preview` | 带鉴权的网格路由；必须留在 `/api` 下。 |
| `extensions` | `["stl"]` | 走 3D 预览的后缀。 |
| `maxBytes` | `536870912` | 允许流式读取的最大 STL（512 MiB）。 |
| `chunkBytes` | `1048576` | Host 每段读取的字节数。 |
| `unitScale` | `1` | 每 STL 单位多少毫米；影响尺寸/体积/面积。 |
| `color` | `#c7d2e2` | 视口颜色（STL 不带材质）。 |
| `analysisMaxTriangles` | `400000` | 超过这个三角面数就跳过水密性统计，避免卡死标签页。 |

## 工作原理

```
点击工作区里的 .stl
        │
        ▼
文档预览 body（lib/client.js）
        │  GET /api/stl-preview?path=…   （原始字节，ctx.fs 分块）
        ▼
parseStl(bytes)         二进制：80 字节头 + uint32 计数 + 每面 50 字节
                        ASCII：facet normal / outer loop / vertex
        │
        ├── analyzeStl：包围盒、面积、有符号体积、顶点焊接 + 边表
        └── setGeometry：Z-up → Y-up，上传三角形
```

- 路由挂在 `/api` 下，请求先经过 connection 服务的鉴权（Host/Origin + 会话 cookie）才会读到字节。
- 水密性统计在 `analysisMaxTriangles` 以上会跳过（边表是主要开销），面板会明确写出来。
- 体积用有符号四面体和（`|Σ v0·(v1×v2)/6|`），面积是三角形面积之和。

## 开发

```
dev/client-body.js   客户端 UI、STL 解析与统计（CJS 工厂）
dev/viewer.js        WebGL 渲染器，构建时拼进 bundle
scripts/build-client.mjs   由上面两个文件生成 lib/client.js
scripts/live-selftest.mjs  用发布产物解析真实 STL
scripts/e2e-browser.mjs    针对临时 DSH 实例的 Playwright 端到端
node --test test/*.test.js
```

`lib/client.js` 是生成物——改 `dev/` 下的文件后重新构建。

## 已知边界

- STL 无单位，面板里的毫米值按 `unitScale` 解释（默认 1）；按厘米建模的文件要把它设成 10。
- 超大网格（数百万三角面）在主线程解析，会有一小段等待；水密性统计到 `analysisMaxTriangles` 为止。
- ASCII STL 只解释标准语法里的顶点与法线，不处理顶点色等扩展。
- 不上传任何文件：字节从 Host 经鉴权路由到浏览器，在页面内解析。
