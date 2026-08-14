## 网络与 MQTT

> 车载 T-Box 天天和网络打交道：与平台的长连接、OTA 下载、地图推送、流量排查，全部建立在 TCP/IP 之上。这一模块把分层模型、TCP 可靠性、粘包、MQTT/WebSocket 应用层协议、socket 编程和排查实战串成一条主线，背熟即可应对网络类面试。

> **面试必看章节**：第 2 章 应用层、第 3 章 传输层（面试占比最高）、第 4 章 网络层、第 8 章 安全——每个知识点已标注对应书目章节，备考按需精读。

### TCP/IP 分层模型与封装/解封装

**一句话要点**：四层模型为应用层→传输层→网络层→网络接口层，发送数据逐层加头部（封装），接收数据逐层剥头部（解封装）；TCP 头里带端口、序号、确认号，IP 头里带源/目的 IP 和 TTL。

**面试怎么问**：一个 HTTP 请求从车机发出到服务器，中间经过了哪些封装？TCP 头和 IP 头分别加了哪些关键字段？

**用例 / 示例**：
```text
OSI 七层 ── 对应 TCP/IP 四层 ── 数据单元 ── 典型协议/设备
┌───────────────────────────┐
│ 7 应用层 Application      │
│ 6 表示层 Presentation     │── 应用层 ── 报文 Message ── HTTP/FTP/MQTT
│ 5 会话层 Session          │
├───────────────────────────┤
│ 4 传输层 Transport        │── 传输层 ── 报文段 Segment ── TCP/UDP
├───────────────────────────┤
│ 3 网络层 Network          │── 网络层 ── 分组 Packet ── IP/ICMP/路由器
├───────────────────────────┤
│ 2 数据链路层 Data Link    │── 网络接口层 ── 帧 Frame ── 以太网/交换机/MAC
│ 1 物理层 Physical         │── 网络接口层 ── 比特 Bit ── 光纤/双绞线
└───────────────────────────┘

封装（发送）与解封装（接收）过程（车机发 "GET /ota HTTP/1.1"）：
发送方逐层加头（封装）          链路          接收方逐层剥头（解封装）
┌──────────────────────┐                    ┌──────────────────────┐
│ 应用层: GET /ota ... │                    │ 应用层: GET /ota ... │ ← 最终数据
├──────────────────────┤                    ├──────────────────────┤
│ TCP头: 端口/序号/... │                    │       剥 TCP 头       │
├──────────────────────┤                    ├──────────────────────┤
│ IP头: 源/目的IP/TTL  │ ─────────────────▶ │       剥 IP 头        │
├──────────────────────┤    封装/解封装      ├──────────────────────┤
│ 以太网头: MAC + FCS  │     逐层对应        │     剥以太网头        │
└──────────────────────┘                    └──────────────────────┘

关键字段：TCP头=源/目的端口、序号、确认号、标志位(ACK/SYN/FIN)；
         IP头=版本、TTL、协议号(6=TCP/17=UDP)、源/目的IP
```
**关联项目**：通用基础
**对应章节**：《计算机网络：自顶向下方法》第 1 章 · 协议层次及其服务模型

---

### TCP 三次握手

**一句话要点**：SYN → SYN+ACK → ACK，作用是让双方确认彼此的收发能力，并协商初始序号（ISN），防止旧连接的报文串扰新连接。

**面试怎么问**：为什么是三次不是两次？第三次 ACK 丢了会怎样？

**用例 / 示例**：
```text
TCP 三次握手时序（含连接状态变化）：
  Client(主动)                          Server(被动)
   CLOSED                                LISTEN
     │──① SYN(seq=x) ─────────────────▶│  收到 SYN → 进入 SYN_RCVD
     │（发出后进入 SYN_SENT）           │
     │◀──② SYN+ACK(seq=y, ack=x+1) ────│  回 SYN+ACK（仍在 SYN_RCVD）
     │（收到后校验 ack==x+1）           │
     │──③ ACK(seq=x+1, ack=y+1) ──────▶│  收到 ACK → ESTABLISHED
     ▼                                  ▼
  ESTABLISHED                        ESTABLISHED

第三次 ACK 丢失：
Server 收不到 ACK → 超时重传 SYN+ACK（次数受 tcp_synack_retries 限制）
Client 此时已 ESTABLISHED，仍可正常发送数据（数据包会捎带 ACK 完成确认）
```
**关联项目**：云公交一体机（TCP 与后台平台通信）
**对应章节**：《计算机网络：自顶向下方法》第 3 章 · TCP 连接管理（三次握手）

---

### TCP 四次挥手与 TIME_WAIT 2MSL

**一句话要点**：主动关闭方发 FIN → 对端回 ACK → 对端发 FIN → 主动方回 ACK；主动关闭方进入 TIME_WAIT 并等待 2MSL，目的是保证最后一个 ACK 若丢失能重传、并让旧连接报文在网络中彻底消亡。

**面试怎么问**：为什么 TIME_WAIT 要等 2MSL？服务端大量 TIME_WAIT 怎么处理？

**用例 / 示例**：
```text
TCP 四次挥手时序（含状态变化，A 为主动关闭方）：
  主动关闭方 A                          被动关闭方 B
   ESTABLISHED                          ESTABLISHED
     │──① FIN(seq=u) ─────────────────▶│
     │（进入 FIN_WAIT_1）               │  收到 FIN → 进入 CLOSE_WAIT
     │◀──② ACK(ack=u+1) ───────────────│  回 ACK（同时通知应用关闭读方向）
     │（进入 FIN_WAIT_2）               │
     │                                  │  应用关闭写方向
     │◀──③ FIN(seq=v) ─────────────────│  发 FIN → 进入 LAST_ACK
     │（收到 FIN）                      │
     │──④ ACK(ack=v+1) ───────────────▶│  收到 ACK → CLOSED
     │（进入 TIME_WAIT，等 2MSL）       │
     │………… 2MSL 后 CLOSED ………………      │

TIME_WAIT(2MSL) 两个作用：
1) ④ 的 ACK 若丢失，B 会重传③ 的 FIN，A 还能再回 ACK；
2) 等待 2MSL（约 60~120s）让本连接旧报文在网络中消亡，
   避免端口复用后串扰新连接。
线上处理：服务端大量 TIME_WAIT 可开 SO_REUSEADDR；
调小 TIME_WAIT 需谨慎，先确认业务是否大量短连接。
```
**关联项目**：云公交一体机（TCP 与后台平台通信）、通用基础
**对应章节**：《计算机网络：自顶向下方法》第 3 章 · TCP 连接管理（四次挥手与 TIME_WAIT）

---

### 粘包/拆包的产生与解决

**一句话要点**：TCP 是字节流、没有消息边界，多个小报文被合并发送（粘包）或一个大报文被分多次读（拆包）都会导致对端解析错乱；解决手段是定长报文、分隔符或"长度字段+负载"的自定义帧。

**面试怎么问**：你们车机和平台之间怎么解决粘包？自定义协议为什么用"4 字节长度 + 负载"而不是分隔符？

**用例 / 示例**：
```c
/* 车机自定义协议：4 字节网络序长度 + 负载，最大 1KB */
#define MAX_PKT 1024

/* 从流式接收缓冲区拆帧：返回消耗的字节数；0 表示数据不足继续等 */
int frame_packet(const uint8_t *buf, int len)
{
    uint32_t plen;

    if (len < 4)
        return 0;                 /* 头部都没收全 */

    /* 网络序转主机序：大端 [b0 b1 b2 b3] */
    plen = ((uint32_t)buf[0] << 24) | ((uint32_t)buf[1] << 16)
         | ((uint32_t)buf[2] << 8)  | (uint32_t)buf[3];

    if (plen > MAX_PKT)
        return -1;                /* 非法长度：防缓冲区溢出，主动断链 */

    if (len < 4 + (int)plen)
        return 0;                 /* 负载没收全，等下一次 read */

    /* 到这里是一个完整帧：回调处理 payload = buf + 4，长度 plen */
    return 4 + (int)plen;         /* 返回本帧消耗的字节数 */
}
```
```text
粘包示意（发送端两次 send，接收端一次 read 可能读到的形态）：
发送端：┌────────┐  ┌────────┐
        │ Hello  │  │ World  │
        └────────┘  └────────┘
                  ↓ TCP 字节流
接收端 read 到： [HelloWorld]    ← 两条消息粘成一包，解析错乱
                [Hel][loWorld]  ← 边界错位（拆包），同样解析错

三种解决方案：
① 定长报文：每包固定 N 字节，不足补零
   [Hello\0\0\0][World\0\0\0]   ← 简单，但小包浪费带宽
② 分隔符：包尾加 \n 或 0xFF
   [Hello\n][World\n]           ← 简单，但内容里不能出现分隔符
③ 长度字段（推荐）：4 字节网络序长度 + 负载
   [0005|Hello][0005|World]     ← 精确分帧，见上方 C 代码
```
**关联项目**：云公交一体机（TCP 与后台平台通信）、OTA 排查支持
**对应章节**：教材外补充（对应第 3 章 · 应用层消息边界与 TCP 字节流，面试高频）

---

### TCP 可靠性：序号/确认/重传/滑动窗口/拥塞控制

**一句话要点**：序号+确认号保证有序不丢，超时重传（RTO）处理丢包，滑动窗口按对端通告窗口控制流量；拥塞控制四阶段为慢启动、拥塞避免、快重传、快恢复，共同决定发送速率。

**面试怎么问**：慢启动和拥塞避免的区别？收到 3 个重复 ACK 后为什么走快重传而不是等超时？

**用例 / 示例**：
```text
滑动窗口四区示意（发送方视角，窗口 = min(rwnd, cwnd)，例窗口=4）：
序号:   1  2 | 3  4  5  6 | 7  8 | 9 10 11 ...
区域: 已发送 │ 已发送未确认 │可发送│ 暂不能发
      已确认 │              │      │（等窗口右移）
      └────── 发送窗口(4) ──┘
收到 ACK(5) 后窗口整体右移：3 变已确认，7 进入可发送

TCP 拥塞控制 cwnd 变化示意（纵轴 cwnd，横轴 RTT）：
cwnd
 16│                                         ●← 丢包(3 个重复 ACK)
 14│                                       ╱   快重传：不等超时立即重传
 12│                                     ╱     快恢复：cwnd 降到新 ssthresh
 10│                                   ╱      （≈cwnd/2），不归 1，继续线性增长
  8│════════════ ssthresh 初始=8 ══════╱═════════
  6│                               ╱
  4│                           ╱   ← 慢启动(1→2→4→8，指数翻倍)
  2│                       ╱        到 ssthresh 后转拥塞避免(每 RTT +1 线性)
  1│──●──────────────────────────────────────────
  0└────────────────────────────────────────────▶ RTT
    0  1  2  3  4  5  6  7  8  9  10

滑动窗口：发送窗口 = min(接收方通告窗口 rwnd, 拥塞窗口 cwnd)
慢启动：cwnd 从 1 开始，每个 RTT 翻倍（指数增长），
        直到 cwnd >= ssthresh 转入拥塞避免
拥塞避免：每个 RTT cwnd += 1（线性增长），发生超时则 ssthresh 减半、cwnd 回到 1
快重传：收到 3 个重复 ACK 立即重传丢失段，不用等 RTO 超时（省一个 RTT）
快恢复：cwnd = ssthresh（不回到慢启动），进入拥塞避免线性增长

面试加分：RTO 不是固定值，按 RTT 的加权平均（如 Jacobson/Karn 算法）
动态估算；对车载弱网（隧道、地库）场景，RTO 抖动大是掉线主因。
```
**关联项目**：通用基础、云公交一体机（TCP 与后台平台通信）
**对应章节**：《计算机网络：自顶向下方法》第 3 章 · TCP 可靠数据传输与拥塞控制

---

### UDP vs TCP 选型

**一句话要点**：TCP 面向连接、可靠有序、有拥塞控制但延迟高；UDP 无连接、不可靠、低延迟、支持广播组播。选型看三个问题：丢一包能不能忍、延迟敏不敏感、是点对点还是多端分发。

**面试怎么问**：视频通话和语音为什么用 UDP？OTA 固件下载为什么必须用 TCP？

**用例 / 示例**：
```text
车载真实选型对比：
| 业务                 | 协议 | 原因                                              |
|----------------------|------|---------------------------------------------------|
| OTA 固件包下载       | TCP/HTTPS | 文件必须完整无错，可重传、有校验，慢一点没关系 |
| GNSS 原始观测上报    | UDP  | 实时性强、单条数据小，丢一条不影响整体定位精度   |
| 主动安全报警广播     | UDP 组播 | 一车发、多端收（仪表/网关），TCP 做不到组播      |
| 平台指令下发         | TCP/MQTT | 指令不能丢，需确认                                   |
| 地图/路况推送        | WebSocket| 双向低延迟长连接（PCC 场景）                        |

面试口径：可靠性和实时性冲突时，先量化"丢包代价"——
丢了能重传的用 TCP，丢了就算了、但必须新的用 UDP。
```
**关联项目**：GNSS 固件升级、主动安全系统、预见性巡航 PCC（WebSocket/HTTP 地图方案）
**对应章节**：《计算机网络：自顶向下方法》第 3 章 · UDP 与 TCP（选型对比）

---

### HTTP/HTTPS 与 TLS 握手简述

**一句话要点**：HTTP 是无状态的明文请求/响应协议，方法有 GET/POST/PUT/DELETE，状态码分 1xx~5xx；HTTPS 是在 TCP 之上加 TLS 加密层，握手协商加密套件、校验证书、用非对称加密交换密钥后转入对称加密传输。

**面试怎么问**：HTTPS 握手大体分几步？301 和 302、404 和 502 有什么区别？

**用例 / 示例**：
```bash
# 只看状态码：OTA 平台接口探测
curl -sI https://ota.example.com/v1/package -o /dev/null -w "%{http_code}\n"

# 状态码速记
# 2xx 成功；301 永久重定向；302 临时重定向；
# 404 资源不存在；502 网关/代理拿不到上游响应；504 网关超时
```
```text
TLS 1.2 握手（简要）：
1. ClientHello：客户端随机数 + 支持的加密套件列表
2. ServerHello：选定套件 + 服务器随机数
3. 服务器下发证书（含公钥），客户端校验证书链（CA、域名、有效期）
4. 客户端生成预主密钥，用服务器公钥加密后发送
5. 双方用"客户端随机数+服务器随机数+预主密钥"算出相同会话密钥
6. ChangeCipherSpec + Finished：此后全部走对称加密（AES-GCM 等）
```
**关联项目**：OTA 排查支持（MQTT/HTTPS）、预见性巡航 PCC（WebSocket/HTTP 地图方案）
**对应章节**：《计算机网络：自顶向下方法》第 8 章 · SSL/TLS 与密码学（HTTP 协议基础对应第 2 章 · Web 与 HTTP）

---

### MQTT 协议（重点）

**一句话要点**：MQTT 是基于 TCP 的发布/订阅协议，由 broker 中转，核心报文有 CONNECT/CONNACK/PUBLISH/SUBSCRIBE/SUBACK/PINGREQ；QoS 0 至多一次、QoS 1 至少一次、QoS 2 恰好一次；retain 保留离线前最后一条消息，keepalive 心跳让 broker 感知掉线，遗嘱消息（LWT）由 broker 在客户端异常掉线时代发，断线重连要配合 clean session 和指数退避。

**面试怎么问**：QoS 1 和 QoS 2 的区别？QoS 1 为什么可能收到重复消息？车机掉线平台怎么第一时间知道？遗嘱消息和 retain 分别怎么用？

**用例 / 示例**：
```c
/* 以 paho.mqtt.c 为例：连接参数 + 遗嘱 + 心跳 + 断线重连 */
#include "MQTTClient.h"

#define BROKER   "tcp://47.x.x.x:1883"
#define CLIENTID "tbox-IMEI861234567890123"

int main(void)
{
    MQTTClient client;
    MQTTClient_connectOptions opts = MQTTClient_connectOptions_initializer;
    MQTTClient_willOptions will = MQTTClient_willOptions_initializer;
    int rc, stop = 0;

    MQTTClient_create(&client, BROKER, CLIENTID, MQTTCLIENT_PERSISTENCE_NONE, NULL);

    opts.keepAliveInterval = 60;      /* 60s 心跳：超时未收到 PINGREQ，broker 判离线 */
    opts.cleansession = 1;            /* 重连后不接收离线积压消息，避免流量浪涌 */
    opts.username = "tbox-user";
    opts.password = "****";

    /* 遗嘱：异常掉线时 broker 代发 "offline"，平台据此快速感知车辆失联 */
    will.topicName = "tbox/status";
    will.message = "offline";
    will.qos = 1;
    will.retained = 1;                /* retain：新订阅者也能立即看到最新状态 */
    opts.will = &will;

    while (!stop) {
        rc = MQTTClient_connect(client, &opts);   /* CONNECT → CONNACK */
        if (rc != MQTTCLIENT_SUCCESS) {
            sleep(5);                 /* 指数退避（5s→10s→20s…封顶 60s），防止重连风暴 */
            continue;
        }
        MQTTClient_subscribe(client, "ota/cmd", 1);   /* QoS1 订阅 OTA 指令 */
        MQTTClient_publish(client, "tbox/status", 7, "online", 1, 1, NULL);
        while (MQTTClient_isConnected(client))        /* keepalive 维持连接 */
            sleep(1);
    }
    MQTTClient_destroy(&client);
    return 0;
}
```
```text
MQTT 报文交互时序（T-Box 客户端 ↔ Broker）：
  T-Box(Client)                            Broker
  │── CONNECT(clientId, keepalive=60, 遗嘱) ─▶│
  │◀─ CONNACK(return code=0) ─────────────────│  连接建立
  │── SUBSCRIBE("ota/cmd", QoS1) ────────────▶│
  │◀─ SUBACK(QoS1 允许) ──────────────────────│
  │── PUBLISH("tbox/status","online", QoS1) ─▶│
  │◀─ PUBACK ─────────────────────────────────│  QoS1：至少一次，需应答
  │◀─ PUBLISH("ota/cmd", QoS1) ───────────────│  平台下发 OTA 指令
  │── PUBACK ────────────────────────────────▶│
  │── PINGREQ ───────────────────────────────▶│  keepalive 心跳
  │◀─ PINGRESP ──────────────────────────────│  （60s 一次）
  │                …TCP 异常断开…             │
  │              Broker 代发遗嘱 "offline" ──▶│  LWT 生效，平台感知离线

说明：QoS0 无需应答；QoS1 用 PUBACK 确认；
     QoS2 用 PUBREC→PUBREL→PUBCOMP 四步，保证恰好一次。
```
**关联项目**：OTA 排查支持（MQTT/HTTPS 通道）、eMMC-eSIM 流量异常排查
**对应章节**：教材外补充（对应第 2 章 · 应用层协议，IoT 发布/订阅场景，面试高频）

---

### WebSocket：握手、帧格式、心跳、断线重连

**一句话要点**：WebSocket 通过 HTTP Upgrade 完成握手后建立全双工长连接，数据以帧传输（FIN/opcode/mask/长度）；客户端帧必须置掩码位，应用层要自己实现 PING/PONG 心跳和断线重连。

**面试怎么问**：WebSocket 和 HTTP 长轮询比有什么优势？客户端为什么必须掩码？心跳和重连怎么设计？

**用例 / 示例**：
```text
握手报文（PCC 地图方案，客户端→服务器）：
GET /map HTTP/1.1
Host: pcc-map.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==     ← 客户端随机 16 字节 base64

服务器响应：
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=  ← SHA1(key+GUID) base64

帧格式（2 字节头起步）：
|FIN|RSV|opcode(4)| MASK |payloadLen(7/16/64)| MaskKey(4)| payload
opcode：0x1 文本帧、0x2 二进制、0x8 关闭、0x9 PING、0xA PONG
规则：客户端→服务器必须 MASK=1（防代理缓存投毒）；服务器→客户端不掩码

心跳：客户端每 30s 发 PING，5s 内未收到 PONG 视为断线
重连：指数退避 + 抖动（1s、2s、4s…封顶 60s），重连后
     重新拉取地图全量数据补齐断线期间的路况
```
**关联项目**：预见性巡航 PCC（WebSocket/HTTP 地图方案）
**对应章节**：教材外补充（对应第 2 章 · 应用层协议，WebSocket，面试高频）

---

### socket 编程：TCP/UDP 客户端与服务器骨架

**一句话要点**：TCP 服务端流程 socket→bind→listen→accept→recv/send→close，客户端 socket→connect→send/recv；UDP 无连接，用 sendto/recvfrom 并自带对端地址。每个调用都要检查返回值并处理 EINTR/EAGAIN。

**面试怎么问**：手写一个 TCP echo server？accept 返回的 fd 和监听 fd 有什么区别？

**用例 / 示例**：
```c
/* TCP 回显服务器完整骨架（单连接示例，带错误处理） */
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define PORT 8899
#define BACKLOG 8

int main(void)
{
    int lfd = -1, cfd = -1, on = 1;
    struct sockaddr_in addr;
    char buf[1024];
    ssize_t n;

    lfd = socket(AF_INET, SOCK_STREAM, 0);          /* 1. 建套接字 */
    if (lfd < 0) { perror("socket"); return -1; }

    setsockopt(lfd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on)); /* 端口复用 */

    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);       /* 监听所有网卡 */
    addr.sin_port = htons(PORT);

    if (bind(lfd, (struct sockaddr *)&addr, sizeof(addr)) < 0) { perror("bind"); goto out; }
    if (listen(lfd, BACKLOG) < 0) { perror("listen"); goto out; }

    for (;;) {
        /* 2. 接受连接：返回的是"已连接套接字"，数据收发走它 */
        cfd = accept(lfd, NULL, NULL);
        if (cfd < 0) {
            if (errno == EINTR) continue;           /* 被信号打断，继续 */
            perror("accept"); break;
        }
        /* 3. 回显：循环读到 0(对端关闭)或出错 */
        while ((n = read(cfd, buf, sizeof(buf))) > 0) {
            if (write(cfd, buf, (size_t)n) < 0) break;
        }
        close(cfd);                                 /* 4. 关闭连接 */
        cfd = -1;
    }
out:
    if (cfd >= 0) close(cfd);
    if (lfd >= 0) close(lfd);
    return 0;
}
```
```c
/* UDP 客户端骨架：无连接，每次发送都要带对端地址 */
int fd = socket(AF_INET, SOCK_DGRAM, 0);            /* SOCK_DGRAM */
struct sockaddr_in dst = {0};
dst.sin_family = AF_INET;
dst.sin_port = htons(9999);
inet_pton(AF_INET, "47.x.x.x", &dst.sin_addr);
sendto(fd, "GNSS:31.23,121.47", 17, 0, (struct sockaddr *)&dst, sizeof(dst));
/* 接收同理：recvfrom(fd, buf, len, 0, &src, &srclen) 可拿到来源地址 */
```
```text
TCP socket API 调用流程（Server / Client 对应关系）：
  Server                              Client
  socket() 创建监听套接字              socket() 创建套接字
  bind()   绑定 IP:端口                │
  listen() 进入监听(backlog)           │
  accept() 阻塞等待连接 ←─三次握手──▶ connect() 发起连接
     │ 返回新 fd cfd（四元组标识）     │
  recv()/send() 收发数据     send()/recv() 收发数据
  close() 关闭 cfd            close() 关闭
  close() 关闭监听 fd
关键点：accept 返回的 cfd 与监听 lfd 是两个 fd——
        lfd 只管"接客"，cfd 才是"聊天"的通道；
        UDP 无 listen/accept，直接用 sendto/recvfrom。
```
**关联项目**：云公交一体机（TCP 与后台平台通信）、GNSS 固件升级（UDP 观测数据上报）
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · 套接字编程

---

### select/poll/epoll 对比与适用场景

**一句话要点**：select 受 FD_SETSIZE（1024）限制且每次调用要整体拷贝 fd 集合、O(n) 扫描；poll 用链表解除上限但仍是 O(n)；epoll 由内核维护红黑树 + 就绪链表，只返回就绪事件，O(1) 复杂度，适合大量长连接；边沿触发（ET）需循环读直到 EAGAIN。

**面试怎么问**：epoll 的 LT 和 ET 区别？ET 模式读数据为什么要循环读到 EAGAIN？什么场景用 select 就够了？

**用例 / 示例**：
```c
/* epoll 监听循环骨架（LT 模式） */
#include <sys/epoll.h>

#define MAX_EV 64

int epfd = epoll_create1(0);            /* 创建 epoll 实例 */
struct epoll_event ev, events[MAX_EV];

ev.events = EPOLLIN;                    /* 默认 LT：只要缓冲区有数据就通知 */
ev.data.fd = listen_fd;
epoll_ctl(epfd, EPOLL_CTL_ADD, listen_fd, &ev);   /* 注册监听 fd */

for (;;) {
    int n = epoll_wait(epfd, events, MAX_EV, -1); /* 阻塞等就绪事件 */
    for (int i = 0; i < n; i++) {
        int fd = events[i].data.fd;
        if (fd == listen_fd) {
            int cfd = accept(listen_fd, NULL, NULL);
            ev.events = EPOLLIN;
            ev.data.fd = cfd;
            epoll_ctl(epfd, EPOLL_CTL_ADD, cfd, &ev);  /* 新连接加入监听 */
        } else if (events[i].events & EPOLLIN) {
            /* 可读：LT 读一次即可，没读完下次还会通知；
               ET 则必须 while 循环读到 read 返回 -1 且 errno==EAGAIN */
        }
    }
}
```
```text
select vs epoll 工作机制示意：
select（O(n) 遍历 + 每次拷贝）：
用户态                内核态
[fd1 fd2 fd3 ...] ──拷贝──▶ 遍历全部 fd 查就绪状态
[fd1 fd2 fd3 ...] ◀──结果── 就绪位图拷回，用户态再遍历一遍
→ 每次调用全量扫描+两次拷贝，fd 多时线性开销，上限 1024

epoll（事件回调 + 就绪链表，O(1)）：
用户态                内核态
注册: fd ──epoll_ctl──▶ 红黑树登记关注事件（只加一次）
就绪: fd 有数据 ──────▶ 回调挂入就绪链表
      epoll_wait ◀───── 只取就绪链表 → 有几个事件返回几个

LT vs ET：
LT(水平)：缓冲区还有数据就持续通知 → 读一次没读完，下次还通知
ET(边沿)：只有"空→有数据"变化时通知一次 → 必须循环读到 EAGAIN
```
**对应章节**：跨领域（操作系统 · IO 多路复用，教材外补充）

---

### 常用 socket 选项

**一句话要点**：SO_REUSEADDR 让 TIME_WAIT 状态下的端口能立即复用，解决服务重启失败；SO_KEEPALIVE 靠内核探测包识别死连接（可调 TCP_KEEPIDLE/INTVL/CNT）；TCP_NODELAY 关闭 Nagle 算法、小包立即发送，降低交互延迟；非阻塞模式下 read/write 返回 -1 且 errno=EAGAIN 表示"现在没数据，别当错误"。

**面试怎么问**：服务重启报"Address already in use"怎么解决？SO_KEEPALIVE 和 MQTT keepalive 是一回事吗？TCP_NODELAY 为什么能降延迟？

**用例 / 示例**：
```c
#include <sys/socket.h>
#include <netinet/tcp.h>

int fd, on = 1;

/* 1. SO_REUSEADDR：重启服务时端口还在 TIME_WAIT 也能立刻 bind 成功 */
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on));

/* 2. SO_KEEPALIVE：内核级探测，2h 无数据才启动（默认太慢，要调参） */
on = 1;
setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, &on, sizeof(on));
int idle = 60, intvl = 10, cnt = 3;   /* 60s 无数据发探测，10s 一次，3 次无响应判死 */
setsockopt(fd, IPPROTO_TCP, TCP_KEEPIDLE,  &idle, sizeof(idle));
setsockopt(fd, IPPROTO_TCP, TCP_KEEPINTVL, &intvl, sizeof(intvl));
setsockopt(fd, IPPROTO_TCP, TCP_KEEPCNT,   &cnt,  sizeof(cnt));

/* 3. TCP_NODELAY：关 Nagle，小包立即发（PCC 地图请求这种一问一答场景延迟敏感） */
on = 1;
setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &on, sizeof(on));

/* 4. 非阻塞：fcntl 设置后，recv 无数据返回 -1/errno==EAGAIN，配合 epoll 使用 */
#include <fcntl.h>
int flags = fcntl(fd, F_GETFL, 0);
fcntl(fd, F_SETFL, flags | O_NONBLOCK);
```
**关联项目**：云公交一体机（长连接保活）、预见性巡航 PCC（低延迟请求）
**对应章节**：教材外补充（对应第 2 章 · 套接字编程，面试高频）

---

### tcpdump / wireshark 抓包与协议分析

**一句话要点**：tcpdump 是命令行抓包工具，`-i` 选网卡、`-nn` 不做域名反解、`-w` 存 pcap 文件；wireshark 做图形化分析，重点看握手、重传（tcp.analysis.retransmission）、TCP Stream 还原，以及 MQTT/HTTP 应用层报文。

**面试怎么问**：怎么证明"粘包"存在？怎么确认车机在频繁重连服务器？

**用例 / 示例**：
```bash
# 抓车机到 OTA 平台 443 端口的双向流量，保存成 pcap 供 wireshark 分析
tcpdump -i eth0 -nn -s 0 host 47.100.10.20 and port 443 -w ota.pcap

# 只看 TCP 连接建立/关闭与重传（终端实时看）
tcpdump -i eth0 -nn 'tcp[tcpflags] & (tcp-syn|tcp-fin|tcp-rst) != 0'

# wireshark 分析套路：
# 1. Statistics -> Conversations：按流量排序，找异常连接
# 2. 过滤 tcp.analysis.retransmission：重传数量与分布
# 3. 过滤 mqtt：看 CONNECT/PUBLISH/SUBSCRIBE 频率
# 4. Follow TCP Stream：还原应用层字节流，直接判断粘包/协议字段错误
```
**关联项目**：eMMC-eSIM 流量异常排查、OTA 排查支持（MQTT/HTTPS 通道）
**对应章节**：教材外补充（对应第 1 章 · 网络实践工具，面试高频）

---

### 网络问题排查思路实战

**一句话要点**：按"链路层→IP→TCP→应用层"逐层收敛：先 ping/traceroute 验证连通，再抓包看握手、重传、断开原因，最后对照应用日志定位；流量异常重点查"重连频率、重传率、心跳是否生效"。

**面试怎么问**：客户报"车机连不上平台"，你怎么一步步查？月初流量暴涨 3 倍，怎么定位根因？

**用例 / 示例**：
```text
实战场景：云公交一体机月流量暴涨 3 倍（eMMC-eSIM 排查）
1. 链路层：ping 平台 IP 通，traceroute 无明显丢包 → 网络本身没问题
2. 抓包：tcpdump -i eth0 -nn 'port 1883' -w mqtt.pcap 抓 30 分钟
3. 统计连接：wireshark Conversations 发现 60 秒内新建连接 200+ 次
4. 看细节：MQTT 报文流反复 CONNECT→CONNACK→SUBSCRIBE→(RST)，
   且无 PINGREQ → 客户端 keepalive 根本没生效
5. 定位根因：业务线程偶发阻塞导致 TCP 超时被内核断开，
   重连逻辑无退避，每秒重连一次 → 握手包+重复订阅撑爆流量
6. 修复：① 补 keepalive 心跳；② 重连指数退避(1s~60s)；
   ③ 断线重连只补发未确认报文，不重复全量订阅

排查口诀：先通不通（ping），再连不连（握手），
         后稳不稳（重传/断线），最后看应用（日志/协议字段）。
```
**关联项目**：eMMC-eSIM 流量异常排查、OTA 排查支持（MQTT/HTTPS 通道）
**对应章节**：教材外补充（对应第 1 章 · 网络实践与排查思路，面试高频）

---

### ISO 七层模型

**一句话要点**：自下而上为物理层、数据链路层、网络层、传输层、会话层、表示层、应用层，每层只处理自己负责的数据单元（比特/帧/分组/报文段/报文）；与 TCP/IP 四层模型是抽象程度不同的对应关系。

**面试怎么问**：七层模型每层的数据单元分别叫什么？TCP/IP 四层和 OSI 七层怎么对应？

**用例 / 示例**：
```text
OSI 七层                 数据单元        典型协议/设备         TCP/IP 四层
7 应用层 Application     报文 Message     HTTP/FTP/MQTT         应用层
6 表示层 Presentation    报文             加密/压缩/字符编码     应用层
5 会话层 Session         报文             建立/维持/释放会话     应用层
4 传输层 Transport       报文段 Segment   TCP/UDP               传输层
3 网络层 Network         分组 Packet      IP/ICMP/路由器        网络层
2 数据链路层 Data Link   帧 Frame         以太网/交换机/MAC      网络接口层
1 物理层 Physical        比特 Bit         双绞线/光纤/集线器     网络接口层

记忆口诀：物、数、网、传、会、表、应（倒背：应表会传网数物）
```
**关联项目**：通用基础
**对应章节**：《计算机网络：自顶向下方法》第 1 章 · 协议层次及其服务模型（OSI 参考）

---

### 两种网络通信方式：C/S 与 P2P

**一句话要点**：C/S（客户/服务器）由中心服务器集中提供服务，客户端发起请求、服务器响应，结构简单但服务器是瓶颈；P2P（对等网络）每个节点既当客户端又当服务器，可扩展性好、无单点故障。

**面试怎么问**：为什么网盘用 C/S、而 BT 下载用 P2P？车联网平台属于哪种模式？

**用例 / 示例**：
```text
| 维度      | C/S 客户/服务器                  | P2P 对等网络                    |
|-----------|----------------------------------|---------------------------------|
| 角色      | 客户端请求、服务器响应，角色固定   | 节点既请求又提供服务，角色对等   |
| 典型场景  | Web/数据库/车联网平台             | 文件共享(BT)/实时通信/分布式     |
| 优点      | 集中管理、数据一致、安全可控       | 可扩展强、无单点故障、成本低     |
| 缺点      | 服务器瓶颈、单点故障               | 安全/管理难、节点质量参差        |
| 车联网案例| 车机 MQTT 连 broker、OTA 平台下载  | V2V 车车直连短距消息（部分场景） |

面试口径：车联网平台本质是 C/S——T-Box 是客户端，
broker/平台是服务端；P2P 更多出现在 V2V 通信与文件分发场景。
```
**关联项目**：云公交一体机（TCP 与后台平台通信）、OTA 排查支持
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · 网络应用体系结构（C/S 与 P2P）

---

### 子网掩码与子网划分

**一句话要点**：子网掩码与 IP 做"与"运算得到网络地址，1 表示网络位、0 表示主机位；CIDR 写法如 192.168.1.0/24 表示前 24 位是网络位；划分步骤：定网络范围→选掩码长度→与运算得网络地址→算广播地址与可用主机数（2^n - 2）。

**面试怎么问**：192.168.1.0/24 划分成 4 个子网怎么做？给一个 IP 和掩码，怎么算出网络地址和广播地址？

**用例 / 示例**：
```text
示例：把 192.168.1.0/24 划分成 4 个子网
1. 确定网络范围：192.168.1.0/24，主机位 8 位
2. 选掩码长度：要 4 个子网 → 借 2 位主机位 → /26
   掩码 255.255.255.192（前 26 位为 1）
3. 与运算得网络地址（每个子网步长 2^6 = 64）：
   192.168.1.0/26     可用 .1 ~ .62       广播 .63
   192.168.1.64/26    可用 .65 ~ .126     广播 .127
   192.168.1.128/26   可用 .129 ~ .190    广播 .191
   192.168.1.192/26   可用 .193 ~ .254    广播 .255
4. 每个子网可用主机数 = 2^6 - 2 = 62（去掉网络地址和广播地址）

速算广播地址：网络地址 + 主机位全置 1
例：192.168.1.0/26 → 主机位 6 位全 1 → 192.168.1.0 | 0.0.0.63
   = 192.168.1.63
```
```text
/24 划分成 4 个 /26 子网的地址块示意：
192.168.1.0/24 整体（256 个地址）：
┌──────────────────────────────────────────────────────────┐
│                    192.168.1.0/24                        │
└──────────────────────────────────────────────────────────┘
借 2 位主机位 → /26，等分 4 块（每块步长 2^6 = 64）：
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 子网1        │ 子网2        │ 子网3        │ 子网4        │
│ 192.168.1.0  │ 192.168.1.64 │ 192.168.1.128│ 192.168.1.192│
│ 可用 1~62    │ 可用 65~126  │ 可用 129~190 │ 可用 193~254 │
│ 广播 .63     │ 广播 .127    │ 广播 .191    │ 广播 .255    │
└──────────────┴──────────────┴──────────────┴──────────────┘
每子网可用主机数 = 2^(32-26) - 2 = 2^6 - 2 = 62
```
**关联项目**：通用基础
**对应章节**：《计算机网络：自顶向下方法》第 4 章 · IPv4 编址与子网划分

---

### 网关的作用

**一句话要点**：网关是跨网段通信的"出口"，负责数据转发、协议转换、NAT 地址转换（内网访问外网）和安全过滤；同一网段直连通信不需要网关，跨网段必须经网关逐跳转发。

**面试怎么问**：为什么两个不同网段的设备配了网关才能互通？默认网关配错会有什么现象？

**用例 / 示例**：
```text
典型拓扑：车机(192.168.1.100/24) → 网关(192.168.1.1) → 平台(47.x.x.x)
1. 车机发往 47.x.x.x：与本地掩码做与运算，发现目标不在同一网段
   → 交给默认网关 192.168.1.1 转发
2. 网关做 NAT：把源地址 192.168.1.100 换成公网出口 IP，
   回包再转换回来（内网访问外网的核心机制）
3. 安全过滤：网关（防火墙）可放行/丢弃指定端口，如只放行
   443(HTTPS)、1883(MQTT)，屏蔽其余入站
```
```bash
# 查看默认网关（0.0.0.0 那条即默认网关）
route -n
ip route show default

# 添加/删除默认网关
sudo ip route add default via 192.168.1.1 dev eth0
sudo ip route del default

# 网关配错的典型现象：本网段能通、访问外网全不通
```
**关联项目**：通用基础、云公交一体机（车载网关/路由排查）
**对应章节**：《计算机网络：自顶向下方法》第 4 章 · IPv4 编址与路由器（网关/NAT）

---

### IP 地址分类与表示

**一句话要点**：IPv4 是 32 位点分十进制；A 类 1-126（8 位网络位）、B 类 128-191（16 位）、C 类 192-223（24 位）、D 类 224-239 组播、E 类 240-255 保留；私有地址 10.0.0.0/8、172.16.0.0/12、192.168.0.0/16，回环地址 127.0.0.1；IPv6 是 128 位冒号十六进制表示。

**面试怎么问**：192.168.x.x 是公网还是私有地址？127.0.0.1 和 0.0.0.0 有什么区别？IPv4 地址不够用怎么解决？

**用例 / 示例**：
```text
IPv4 分类速查：
A 类：1.0.0.0 ~ 126.255.255.255   网络位 8 位，可用于大型网络
B 类：128.0.0.0 ~ 191.255.255.255 网络位 16 位
C 类：192.0.0.0 ~ 223.255.255.255 网络位 24 位（典型局域网段）
D 类：224.0.0.0 ~ 239.255.255.255 组播（批量升级可考虑组播下发）
E 类：240.0.0.0 ~ 255.255.255.255 保留

私有地址（内网可重复使用，公网不可路由）：
10.0.0.0/8        A 类私有段
172.16.0.0/12     B 类私有段（172.16 ~ 172.31）
192.168.0.0/16    C 类私有段（最常见的车机内网段）

特殊地址：
127.0.0.1 回环地址，只在本机内通信（测试本机协议栈）
0.0.0.0 表示"本机所有网卡"（bind 监听全部网卡时使用）

IPv6 简介：128 位、8 组冒号十六进制，如 fe80::1%eth0；
用于解决 IPv4 枯竭，与 NAT 配合过渡；车载远程诊断逐步向 IPv6 演进
```
**关联项目**：通用基础
**对应章节**：《计算机网络：自顶向下方法》第 4 章 · IPv4 编址（分类/私有地址/IPv6）

---

### 分组交换

**一句话要点**：数据拆成独立分组，各自携带目的地址逐跳转发、动态选路，多条数据流统计复用链路带宽；优点是链路利用率高、故障可绕行、失败分组可重传；缺点是存在延迟抖动、每分组有头部开销、分组可能乱序或丢失。

**面试怎么问**：分组交换和电路交换的本质区别？为什么互联网用分组交换而传统电话用电路交换？

**用例 / 示例**：
```text
| 维度       | 电路交换                            | 分组交换                       |
|------------|-------------------------------------|--------------------------------|
| 资源占用   | 通话期间独占一条物理链路             | 分组独立转发，统计复用带宽      |
| 建立连接   | 先拨号建立连接，再通信               | 无需先建连接（数据报方式）      |
| 可靠性     | 传输稳定、延迟固定                   | 可能乱序/丢失，靠 TCP 重传      |
| 利用率     | 静默时链路被浪费                     | 高（多个流共享链路）            |
| 典型应用   | 传统电话网 PSTN                      | 互联网/车联网                   |

车联网视角：
- OTA 大文件：IP 网络天然分组交换，分包传输 + 断点续传；
- 主动安全告警：分组交换引入的抖动可借 QoS 优先级缓解；
- 车载总线（如 CAN）更像"报文交换"，与 IP 分组交换理念相通
```
**关联项目**：通用基础、OTA 排查支持（大文件分包传输）
**对应章节**：《计算机网络：自顶向下方法》第 1 章 · 网络核心（分组交换 vs 电路交换）

---

### 网络调试工具

**一句话要点**：ping 验证连通性与 RTT（ICMP）；traceroute/tracert 跟踪每一跳路径；nslookup/dig 做 DNS 查询；netstat/ss 查看端口与连接状态；tcpdump/wireshark 抓包分析；curl 直接发 HTTP 请求测接口。分层定位时按"通不通→哪一跳→域名解析→端口→报文→应用"选用。

**面试怎么问**：客户说连不上平台，你依次用哪些命令排查？怎么确认是 DNS 问题还是端口问题？

**用例 / 示例**：
```bash
# 1. 连通性 + 延迟：ping 不通先怀疑网络/防火墙
ping -c 4 47.100.10.20

# 2. 路径跟踪：看在哪一跳丢包/超时（区分公网路由问题）
traceroute -n 47.100.10.20        # Windows 用 tracert

# 3. DNS 解析：确认域名解析到预期 IP，解析失败会报 NXDOMAIN
nslookup ota.example.com
dig ota.example.com +short

# 4. 端口与连接状态：看 1883 是否 LISTEN、有多少 ESTABLISHED/TIME_WAIT
netstat -ant | grep 1883
ss -antp | grep 1883

# 5. 抓包分析（粘包/重连/协议字段问题）
sudo tcpdump -i eth0 -nn 'port 1883' -w mqtt.pcap

# 6. HTTP 接口探测：状态码 + 总耗时
curl -sI -o /dev/null -w "%{http_code} %{time_total}s\n" https://ota.example.com/v1/ping
```
**关联项目**：eMMC-eSIM 流量异常排查、OTA 排查支持（MQTT/HTTPS 通道）、通用基础
**对应章节**：教材外补充（对应第 1 章 · 网络实践工具，面试高频）

---

### TCP 报文格式详解

**一句话要点**：TCP 头最小 20 字节，含源/目的端口(16bit)、序列号(32bit)、确认号(32bit)、数据偏移(4bit)、标志位(URG/ACK/PSH/RST/SYN/FIN)、窗口大小(16bit，流量控制)、校验和(16bit)、紧急指针与选项（MSS 等）；对比 UDP 头只有 8 字节，多出的字段正是 TCP 可靠性的开销所在。

**面试怎么问**：TCP 头比 UDP 头多了哪些字段，各自干什么用？SYN、ACK、FIN、RST 分别在什么场景出现？数据偏移字段为什么存在？

**用例 / 示例**：
```text
TCP 报文头字段示意表（最小 20 字节）：
| 字段         | 位数   | 作用                                        |
|--------------|--------|---------------------------------------------|
| 源端口       | 16bit  | 发送方端口，标识上层应用                     |
| 目的端口     | 16bit  | 接收方端口                                   |
| 序列号 seq   | 32bit  | 本报文段第一个字节的序号，接收方据此有序重组  |
| 确认号 ack   | 32bit  | 期望收到对方下一个字节的序号                 |
| 数据偏移     | 4bit   | 头部长度（以 4 字节为单位），最小 5 → 20 字节 |
| 保留位       | 6bit   | 预留，目前必须为 0                           |
| 标志位       | 6bit   | URG/ACK/PSH/RST/SYN/FIN                      |
| 窗口大小     | 16bit  | 接收方通告的可用缓冲区，滑动窗口流量控制核心  |
| 校验和       | 16bit  | 覆盖 TCP 头 + 数据的差错检测                 |
| 紧急指针     | 16bit  | 配合 URG 使用（带外数据，实际很少用）         |
| 选项         | 可变   | MSS、窗口缩放、时间戳等                      |

标志位用途表：
URG 紧急指针有效，优先处理（实际场景极少用）
ACK 确认号有效，几乎每个数据包都置 1
PSH 立即把数据推给应用，不攒缓冲区
RST 异常复位连接：端口没监听、协议错误、连接已断开
SYN 同步初始序列号，建立连接（三次握手）
FIN 主动关闭连接（四次挥手）
```
```text
TCP 头 20 字节布局（按 32 位=4 字节一行，RFC 793）：
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         源端口(16bit)          |       目的端口(16bit)         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        序列号 seq(32bit)                       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       确认号 ack(32bit)                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| 数据偏移(4)|保留(6)|U|A|P|R|S|F|      窗口大小(16bit)          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          校验和(16bit)         |        紧急指针(16bit)        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        选项 Options(可变)                      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
数据偏移(4bit)：以 4 字节为单位，5 = 20 字节头（无选项时）
标志位：U=URG  A=ACK  P=PSH  R=RST  S=SYN  F=FIN
```
**关联项目**：通用基础
**对应章节**：《计算机网络：自顶向下方法》第 3 章 · TCP 报文段结构

---

### SYN 攻击（SYN Flood）与防御

**一句话要点**：攻击者伪造大量源 IP 发送 SYN，服务端回复 SYN+ACK 后进入半连接（SYN_RECV）等待 ACK，大量半连接耗尽内存与连接队列，正常请求无法响应；防御核心是 SYN cookies（不分配资源、用加密序列号验证对端）加限制队列长度、缩短 SYN 超时（内核参数 tcp_syncookies）。

**面试怎么问**：SYN Flood 为什么能打挂服务器？tcp_syncookies 的原理是什么？半连接队列满了会发生什么？

**用例 / 示例**：
```text
SYN Flood 攻击流程：
攻击者                  服务器
伪造SYN(假IP) ────────→ 分配半连接，入 SYN_RECV 队列
伪造SYN(假IP) ────────→ 队列 +1（假 IP 不回 ACK，握手永远完不成）
伪造SYN(假IP) ────────→ 队列持续增长直至占满
正常用户 SYN ─────────→ 队列已满被丢弃 → 服务不可用

防御措施：
1. SYN cookies：收到 SYN 不分配连接资源，用源/目的 IP+端口
   和时间戳做哈希生成序列号（cookie）回给对端；对端 ACK 回来
   时验算 cookie 通过才真正建立连接 → 伪造 IP 回不了 ACK 自然失效
2. 限制半连接队列长度（tcp_max_syn_backlog），防止内存被拖垮
3. 缩短 SYN 超时重传次数（tcp_syn_retries），快速清理无效半连接
4. 内核开启：sysctl -w net.ipv4.tcp_syncookies=1
```
```bash
# 查看/开启 SYN cookies 与半连接队列上限
sysctl net.ipv4.tcp_syncookies          # 1=开启
sysctl -w net.ipv4.tcp_syncookies=1
sysctl net.ipv4.tcp_max_syn_backlog     # 半连接队列上限
netstat -s | grep -i syncookies         # 查看 cookie 命中统计
```
**关联项目**：通用基础（T-Box 侧理解攻击原理，服务端由平台防护）
**对应章节**：《计算机网络：自顶向下方法》第 3 章 · TCP 连接管理（SYN 洪泛）；另见第 8 章 · 网络安全（DoS 攻击与防御）

---

### UDP 头部格式

**一句话要点**：UDP 头固定 8 字节，只有源端口(16bit)、目的端口(16bit)、长度(16bit，头+数据，最小 8)、校验和(16bit)，后面直接跟数据，整个数据报最大 65535 字节；没有序列号/确认号/标志位/窗口，所以不保证可靠、无序、无拥塞控制——这正是它头比 TCP（20 字节+选项）简单的原因。

**面试怎么问**：UDP 头为什么只有 8 字节？UDP 长度字段最小为什么是 8？UDP 校验和覆盖哪些内容？

**用例 / 示例**：
```text
UDP 报文头字段示意表（固定 8 字节）：
| 字段         | 位数   | 作用                                     |
|--------------|--------|------------------------------------------|
| 源端口       | 16bit  | 发送方端口（可选，不需要可填 0）          |
| 目的端口     | 16bit  | 接收方端口                               |
| 长度         | 16bit  | UDP 头+数据的总长度，最小 8（只有头无数据）|
| 校验和       | 16bit  | 覆盖 UDP 头+数据+伪头部（含 IP 地址）     |
| 数据         | 可变   | 应用负载，最大 65535 - 8 - IP头(20)       |

对比 TCP 头（最小 20 字节 + 选项）：
UDP 无 序列号/确认号/标志位/窗口/选项
→ 无可靠传输、无顺序保证、无流量与拥塞控制、
  无连接状态（无握手/挥手），所以头短、开销小、延迟低

面试口径：UDP 把"可靠性"问题留给上层——要么应用能容忍
丢包（语音/视频/传感器上报），要么应用自己实现可靠性（见下一条）。
```
```text
UDP 头 8 字节布局（RFC 768）：
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         源端口(16bit)          |        目的端口(16bit)        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|           长度(16bit)          |          校验和(16bit)        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                           数据(可变)                           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
长度 = 8 + 数据长度，最小 8（只有头无数据）；
校验和覆盖 伪头(源/目的IP+协议号) + UDP头 + 数据；
对比 TCP：UDP 无 序号/确认号/标志位/窗口/选项 → 头固定 8 字节
```
**关联项目**：通用基础、GNSS 固件升级（观测数据 UDP 上报）
**对应章节**：《计算机网络：自顶向下方法》第 3 章 · UDP 报文段结构

---

### 如何让 UDP 变得可靠

**一句话要点**：在应用层给 UDP 补可靠性：序列号做乱序检测、ACK 确认、超时重传、ARQ 自动重传请求（停等/回退 N/选择重传）、去重；典型实现有 TFTP、RUDP、QUIC——QUIC 正是基于 UDP 在用户态实现了可靠、有序与拥塞控制。

**面试怎么问**：如果让你在 UDP 上做一个可靠传输，你会加哪些机制？ARQ 的停等、回退 N、选择重传区别？QUIC 为什么选 UDP 而不是 TCP？

**用例 / 示例**：
```text
应用层可靠 UDP 的要素：
1. 序列号：接收方检测乱序与重复
2. ACK 确认：接收方确认收到哪些序号
3. 超时重传：发送方超时未收到 ACK 就重发
4. ARQ 自动重传请求三种策略：
   停等(Stop-and-Wait)     发 1 等 1，简单但吞吐低
   回退 N(Go-Back-N)       连续发送，出错则从该序号全部重传
   选择重传(Selective Repeat) 只重传丢失的那一个，效率最高
5. 去重：序号已收过则丢弃（配合缓冲区）

现实协议：
TFTP  : 经典停等 ARQ，用于简单文件传输
RUDP  : 可靠 UDP，用于游戏/实时音视频弱网场景
QUIC  : 基于 UDP 实现可靠+有序+拥塞控制+0-RTT 连接，
        连接迁移（换 IP 不断连），HTTP/3 的底层

权衡：
可靠 = 加机制，加机制 = 加复杂度/延迟/头部开销；
弱网（车载）下比 TCP 更可控，但重传逻辑、拥塞控制
都要自己实现并充分测试，性价比不如直接用 TCP。
```
**关联项目**：通用基础（主动安全/实时上报类协议设计参考）
**对应章节**：教材外补充（对应第 3 章 · 可靠数据传输原理与 UDP，面试高频）

---

### 为什么 UDP 不粘包 + 如何减小 UDP 延迟

**一句话要点**：UDP 是数据报协议、有消息边界，每次 sendto 就是一个独立数据报，接收方一次 recvfrom 收到一条，天然不会像 TCP 字节流那样粘包；减小 UDP 延迟的方法有控制报文大小避免 IP 分片、零拷贝减少拷贝次数、按带宽延迟积选速率、合理设置超时与缓冲。

**面试怎么问**：UDP 会粘包吗？为什么？UDP 报文太大（超过 MTU）会怎样？

**用例 / 示例**：
```text
为什么 UDP 不粘包：
TCP 是字节流，无边界 → 需要自定义帧（长度字段等）解决粘包；
UDP 每个数据报独立，recvfrom 一次只返回一个完整数据报
→ 不存在"多条消息粘在一起"的问题；
但要注意：recvfrom 缓冲区小于数据报长度时，
多余部分会被内核丢弃（截断），所以接收缓冲要足够大。

减小 UDP 延迟的方法：
1. 控制报文大小：应用数据 + UDP头(8) + IP头(20) 尽量小于 MTU
   （以太网 1500，IPv4 建议 < 1472），避免 IP 分片——
   分片丢一片则整包丢弃，弱网下重传代价极大
2. 零拷贝/内存映射：减少内核态到用户态的拷贝次数
3. 速率控制：按"带宽 × 往返时延（BDP）"估算合理发送速率，
   避免突发打爆链路
4. 合理设置超时：接收超时设太小会误判丢包提前重发，反而增加负载

车载示例：GNSS 观测上报单包 < 1400 字节、按 1Hz 均匀发送，
避开分片与突发，比"攒大包猛发"延迟更稳。
```
**关联项目**：GNSS 固件升级（观测数据 UDP 上报）、通用基础
**对应章节**：教材外补充（对应第 3 章 · UDP 与 TCP，消息边界，面试高频）

---

### 什么是 Socket、属于哪一层

**一句话要点**：Socket 是操作系统提供给应用层的"传输层编程接口"（API），封装了 TCP/UDP 的创建、连接、收发、关闭，不属于严格的 OSI 分层，常表述为"传输层之上的抽象接口"；四元组（源 IP、源端口、目的 IP、目的端口）唯一标识一条 TCP 连接。

**面试怎么问**：Socket 属于 OSI 哪一层？为什么说它是接口而不是协议？一条 TCP 连接靠什么唯一标识？

**用例 / 示例**：
```text
Socket 定位：
应用层 (HTTP/MQTT/自定义协议)
   ↑  socket()/bind()/connect()/listen()/accept()/send()/recv()
   |   ← Socket API：编程接口，不是协议
传输层 (TCP/UDP)
网络层 (IP)
链路层/物理层

套接字四元组：{源IP, 源端口, 目的IP, 目的端口}
例：{10.0.0.5:50000, 47.x.x.x:1883}
→ 服务端同一端口可同时维持海量连接，
   靠四元组区分是哪个客户端（accept 返回新 fd 的原因）

两种套接字：
SOCK_STREAM（TCP）：字节流，无边界，可靠有序
SOCK_DGRAM（UDP）：数据报，有边界，不保证可靠

面试口径：socket 是"门面"——程序员不直接碰内核 TCP/IP
实现，而是通过 socket 文件描述符读写数据。
```
**关联项目**：通用基础、云公交一体机（TCP 与后台平台通信）
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · 套接字编程

---

### 长连接 vs 短连接

**一句话要点**：长连接一次建立多次传输，省去频繁握手的开销，适合高频率、小数据量通信（MQTT/WebSocket/车机与云平台）；短连接每次请求都新建、用完即关，实现简单但握手开销大；HTTP/1.1 默认 keep-alive 复用连接，`Connection: close` 关闭复用。

**面试怎么问**：T-Box 上报车辆数据为什么用 MQTT 长连接而不是每次 HTTP 短连接？长连接怎么判断对方还活着？

**用例 / 示例**：
```text
优缺点对比表：
| 维度     | 长连接                                    | 短连接                      |
|----------|-------------------------------------------|-----------------------------|
| 连接次数 | 一次建立、多次复用                        | 每次请求新建+关闭           |
| 开销     | 仅首次握手，之后零握手成本                | 每次都要三次握手+四次挥手   |
| 延迟     | 低（省去每次握手 RTT）                    | 高（每个请求多 1~2 个 RTT） |
| 资源     | 长期占用 fd/内核资源，需保活与心跳        | 用完即释放，但 TIME_WAIT 多 |
| 适用     | 频繁小报文：MQTT/WebSocket/车联网上报     | 低频大请求：一次查询、下载   |

HTTP 连接复用：
HTTP/1.1 默认 keep-alive（同一 TCP 上连续发多个请求）
Connection: close → 响应后关闭，退回"一请求一连接"

T-Box 场景举例：
- 车况/位置上报、指令下发：MQTT 长连接 + keepalive 心跳
  （60s 一次 PINGREQ），断线自动重连
- 固件包下载：HTTP 短连接按分片请求，配合 Range 断点续传
```
**关联项目**：OTA 排查支持（MQTT/HTTPS 通道）、云公交一体机（TCP 与后台平台通信）
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · Web 与 HTTP（持久连接 keep-alive）

---

### 高并发与短连接场景应对 + 负载均衡

**一句话要点**：应对高并发短连接的关键是减少每连接开销：IO 多路复用（select/poll/epoll 单线程管多连接）、长连接复用、连接池、消息队列削峰、缓存；服务端水平扩展靠负载均衡，算法有轮询、加权轮询、IP-Hash、最少连接、一致性哈希，按场景取舍。

**面试怎么问**：服务器扛不住海量短连接怎么办？负载均衡"最少连接"和"轮询"分别适合什么场景？

**用例 / 示例**：
```text
高并发应对手段：
1. IO 多路复用：epoll 单线程管理上万连接（事件驱动，不阻塞）
2. 长连接复用：客户端/服务端复用 TCP，避免每次握手（MQTT/HTTP keep-alive）
3. 连接池：数据库等重资源预建一批连接反复借用，省去建连成本
4. 消息队列削峰：上报洪峰先入队，平台按处理能力消费，防止打爆
5. 缓存：热点数据（车辆档案、路由表）放内存，减少后端压力

负载均衡算法：
| 算法         | 原理                           | 优点             | 缺点/适用                     |
|--------------|--------------------------------|------------------|-------------------------------|
| 轮询         | 依次分发                       | 简单、均匀       | 不考虑服务器差异              |
| 加权轮询     | 按权重分配（新机器权重低）     | 兼顾机器性能     | 权重需人工调                  |
| IP-Hash      | 按客户端 IP 哈希固定到一台     | 会话保持         | 某 IP 流量大时倾斜            |
| 最少连接     | 分给当前连接最少的节点         | 负载更均衡       | 长连接场景效果差（连接数≠负载）|
| 一致性哈希   | 哈希环+虚拟节点，增删节点影响小| 缓存类业务命中率高 | 实现复杂                      |

车联网口径：T-Box 上报是典型的"海量长连接"，平台侧
常用最少连接/一致性哈希配合 MQTT broker 集群。
```
**关联项目**：云公交一体机（并发通道）、OTA 排查支持（平台侧架构理解）
**对应章节**：教材外补充（对应第 2 章 · Web 与 HTTP，负载均衡，面试高频）

---

### Nagle 算法

**一句话要点**：Nagle 算法把多个小数据包缓冲合并，等收到前一个包的 ACK 或缓冲区达到半窗口/满 MSS 才发送，减少线上小包数量、提高带宽利用率；代价是增加交互式小包延迟，是 TCP 粘包的诱因之一；交互式应用（SSH/键盘输入、一问一答请求）用 TCP_NODELAY 关闭它。

**面试怎么问**：Nagle 算法和粘包什么关系？为什么 SSH 会卡顿？TCP_NODELAY 为什么能降低交互延迟？

**用例 / 示例**：
```c
/* 关闭 Nagle：小包立即发送，不等 ACK 攒批 */
#include <sys/socket.h>
#include <netinet/tcp.h>

int fd, on = 1;
setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &on, sizeof(on));
/* 注意：必须用 IPPROTO_TCP，不是 SOL_SOCKET */

/* 典型场景：PCC 地图一问一答、SSH 键盘输入、
   车机与平台的小指令交互——延迟敏感且包很小 */
```
```text
Nagle 工作原理：
发送端有未确认数据时，新来的小数据先入缓冲不发送；
触发条件（满足其一才发）：
1. 收到之前数据的 ACK；
2. 缓冲数据达到 MSS 或发送窗口的一半；
3. TCP_NODELAY 已开启（禁用 Nagle）。

与粘包的关系：
Nagle 是"发送端合并小包"，接收端粘包是"字节流无边界"，
Nagle 会加剧粘包表象，但根因是 TCP 字节流本身；
应用层必须用长度字段/分隔符解帧，不能靠开关 Nagle 解决。

面试口径：高吞吐批量传输（OTA 分片）可以开 Nagle；
交互式小包场景必须 TCP_NODELAY，两者按业务权衡。
```
**关联项目**：预见性巡航 PCC（地图低延迟请求）、通用基础
**对应章节**：《计算机网络：自顶向下方法》第 3 章 · TCP（Nagle 算法，教材外补充）

---

### HTTP 协议特点与一次完整请求流程

**一句话要点**：HTTP 是应用层请求-响应协议，无状态、可扩展、支持缓存与持久连接；一次完整请求为：解析 URL → DNS 解析 → TCP 三次握手 → 发送请求报文 → 服务器处理返回 → 客户端接收处理 → 关闭或复用连接（HTTPS 多一步 TLS 握手）。

**面试怎么问**：一个 HTTP 请求从发出到收到响应经过了哪些环节？HTTP 为什么说无状态？

**用例 / 示例**：
```text
一次完整 HTTP 请求七步：
1. 解析 URL：拆出协议(http/https)、域名、端口(默认80/443)、路径、参数
2. DNS 解析：域名 → IP（先查本地缓存/ hosts，再递归查询）
3. TCP 三次握手：建立连接（HTTPS 在此之后多做一次 TLS 握手）
4. 发送请求报文：请求行 + 请求头 + 空行 + 请求体（如 POST 数据）
5. 服务器处理并返回：状态行 + 响应头 + 响应体
6. 客户端接收处理：解析状态码与响应体（浏览器渲染 / 应用解析 JSON）
7. 关闭或复用连接：Connection: keep-alive 复用，否则四次挥手关闭

特点速记：请求-响应模型、无状态（服务端不记你是谁）、
可扩展（Header 随意加）、支持缓存（Cache-Control/ETag）、
支持持久连接（HTTP/1.1 起默认 keep-alive）。
```
**关联项目**：OTA 排查支持（HTTPS 通道）、预见性巡航 PCC（HTTP 地图方案）
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · Web 与 HTTP

---

### Socket 与 HTTP 的区别

**一句话要点**：Socket 是传输层（TCP/UDP）编程接口，可自定义协议、实时双向、底层灵活；HTTP 是应用层协议，基于 Socket/TCP，固定请求-响应格式、无状态；选型看需求：实时/自定义二进制协议用 Socket，标准 Web/RESTful API 用 HTTP。

**面试怎么问**：为什么有的业务用 Socket 有的用 HTTP？HTTP 底层是不是也是 Socket？

**用例 / 示例**：
```text
| 维度     | Socket（传输层接口）            | HTTP（应用层协议）            |
|----------|---------------------------------|-------------------------------|
| 层次     | 传输层之上的编程接口，可基于TCP/UDP| 应用层协议，基于 TCP(Socket) |
| 数据格式 | 自定义（二进制/任意字节流）      | 固定：请求行/头/体 + 状态码   |
| 通信模式 | 全双工双向，可随时发             | 请求-响应，客户端先发起       |
| 状态     | 长连接可维护状态（如登录态）     | 无状态，靠 Cookie/Session 补  |
| 实时性   | 高（推送/实时数据）              | 轮询或长轮询才能模拟推送      |
| 适用     | 实时通信、自定义协议、游戏       | Web、RESTful API、OTA 下载    |
| 车联网   | MQTT/自定义 TCP 透传（一体机）   | OTA 平台接口、地图拉取（PCC） |

面试口径：HTTP 底层就是 Socket（TCP），
"用 HTTP 还是 Socket"本质是"用标准应用层协议
还是自己定协议"，前者省事标准、后者灵活可控。
```
**关联项目**：云公交一体机（TCP 与后台平台通信）、预见性巡航 PCC（HTTP 地图方案）
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · 套接字编程 / Web 与 HTTP（对比）

---

### HTTP 请求报文结构

**一句话要点**：请求报文 = 请求行（方法 + URL + 协议版本）+ 请求头（Host/User-Agent/Content-Type 等）+ 空行 + 请求体；方法有 GET/POST/PUT/DELETE/HEAD/OPTIONS/PATCH，各自语义不同（GET 查、POST 增/提交、PUT 整体更新、PATCH 局部更新、DELETE 删）。

**面试怎么问**：GET 和 POST 报文结构差在哪？Content-Type 和 Content-Length 各有什么用？

**用例 / 示例**：
```text
POST 请求报文示例：
POST /v1/vehicles/status HTTP/1.1
Host: ota.example.com
User-Agent: TBox/1.0 (Linux; imei-861234567890123)
Content-Type: application/json
Content-Length: 61
Authorization: Bearer <token>
Cookie: session=abc123
Connection: keep-alive

{"lat":31.23,"lon":121.47,"speed":60,"soc":85}

方法用途速记：
GET    查询资源（参数放 URL，可缓存、幂等）
POST   提交/创建资源（参数放请求体）
PUT    整体更新（幂等）
PATCH  局部更新（只传要改的字段）
DELETE 删除资源（幂等）
HEAD   只取响应头（探测存在性/大小）
OPTIONS 询问支持的方法/CORS 预检

关键请求头：
Host 虚拟主机区分域名；User-Agent 客户端标识；
Content-Type 体格式（application/json 等）；
Content-Length 体长度（解决 HTTP 层粘包的分帧依据）；
Authorization 鉴权；Cookie 会话标识；Accept 期望返回格式；
Referer 来源页（防盗链/统计）。
```
**关联项目**：OTA 排查支持（HTTPS 通道）、预见性巡航 PCC（HTTP 地图方案）
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · Web 与 HTTP（请求报文与请求方法）

---

### HTTP 响应报文与常见状态码

**一句话要点**：响应报文 = 状态行（HTTP 版本 + 状态码 + 原因短语）+ 响应头 + 空行 + 响应体；状态码分 1xx 信息、2xx 成功、3xx 重定向、4xx 客户端错误、5xx 服务器错误，背熟 200/201/301/304/400/401/403/404/500/502/503/504 即可应对面试。

**面试怎么问**：403 和 401 的区别？502 和 504 分别表示什么？304 是怎么来的？

**用例 / 示例**：
```text
响应报文示例：
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 45
Cache-Control: max-age=60
Set-Cookie: session=xyz; Path=/; HttpOnly
Date: Mon, 12 Aug 2024 08:00:00 GMT

{"code":0,"data":{"version":"V1.2.3","url":"https://..."}}

常见状态码含义表：
200 OK            成功
201 Created       资源已创建（POST 成功）
204 No Content    成功但无响应体
206 Partial Content 分片下载成功（OTA Range 续传）
301 Moved Permanently 永久重定向（换域名）
302 Found         临时重定向（登录跳转）
304 Not Modified  命中缓存（配合 ETag/If-None-Match）
400 Bad Request   请求格式错误
401 Unauthorized  未认证（没登录/没带 token）
403 Forbidden     已认证但无权限
404 Not Found     资源不存在
405 Method Not Allowed 方法不允许（如只允许 POST）
500 Internal Server Error 服务器内部错误
502 Bad Gateway   网关/代理拿不到上游有效响应
503 Service Unavailable 服务过载/维护中
504 Gateway Timeout 上游响应超时

响应头要点：
Content-Type 响应体格式；Set-Cookie 种会话 Cookie；
Cache-Control 缓存策略（max-age/no-cache）；
Location 配合 3xx 指明跳转地址。
```
**关联项目**：OTA 排查支持（HTTPS 通道）、预见性巡航 PCC（HTTP 地图方案）
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · Web 与 HTTP（响应报文与状态码）

---

### HTTP 无连接与无状态

**一句话要点**：无连接指早期 HTTP/1.0 每个请求独立建连、用完即断（1.1 起持久连接解决）；无状态指服务器不保存客户端上下文、每个请求独立处理；弥补方案是 Cookie（存客户端）+ Session（存服务端，Session ID 经 Cookie 传递）。

**面试怎么问**：HTTP 无状态怎么实现"登录后保持会话"？Cookie 和 Session 的区别？

**用例 / 示例**：
```text
无连接 vs 无状态：
无连接：一次请求一个连接，HTTP/1.0 时代；
        HTTP/1.1 keep-alive 后连接可复用 → "无连接"问题基本解决
无状态：服务器不记客户端，同一用户两个请求互不相干；
        这是设计使然（可水平扩展，任意服务器都能处理请求）

保持状态的方案：
Cookie（客户端侧）：
  服务端 Set-Cookie 下发，浏览器每次请求自动携带
  存少量数据（Session ID、偏好），可被用户清除/篡改
Session（服务端侧）：
  服务端内存/Redis 存用户状态，返回 Session ID
  客户端只存一个 ID，真正数据在服务器 → 安全、容量大
  集群部署需共享 Session（如 Redis）或改用 JWT

| 维度     | Cookie                    | Session              |
|----------|---------------------------|----------------------|
| 存储位置 | 客户端浏览器              | 服务端（内存/Redis） |
| 容量     | 小（约 4KB）              | 大                   |
| 安全性   | 可被篡改，敏感数据不放    | 数据在服务端，较安全 |
| 传递方式 | 随请求头自动携带          | 靠 Session ID（Cookie 里）|

车联网场景：平台对 T-Box 的鉴权常用 token（类似 Session ID），
T-Box 每次请求带 Authorization 头，服务端无状态校验。
```
**关联项目**：OTA 排查支持（HTTPS 通道鉴权）、通用基础
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · Web 与 HTTP（无状态与 Cookie/Session）

---

### 浏览器输入 URL 回车后发生了什么

**一句话要点**：URL 解析 → DNS 解析（本地缓存 → 递归/迭代查询）→ TCP 三次握手 →（HTTPS 加 TLS 握手）→ 发送 HTTP 请求 → 服务器处理返回 → 浏览器解析 HTML/CSS/JS 渲染 → 连接关闭或复用；每个环节都有可追问点（DNS 缓存、CDN、缓存命中、渲染阻塞）。

**面试怎么问**：输入 www.example.com 回车到页面显示，中间经历了什么？DNS 解析顺序是什么？哪些地方有缓存？

**用例 / 示例**：
```text
完整链路（各步骤可追问点标注）：
1. URL 解析：协议/域名/端口/路径/参数
   [追问：默认端口 http=80, https=443]
2. DNS 解析：浏览器缓存 → 系统 hosts → 本地 DNS → 根/顶级/权威
   [追问：DNS 缓存 TTL；CDN 通过 DNS 智能调度到就近节点]
3. TCP 三次握手：SYN→SYN+ACK→ACK
   [追问：RTT 是多少；握手失败怎么排查]
4. TLS 握手（HTTPS）：证书校验 + 协商会话密钥
   [追问：证书过期/域名不匹配会怎样——浏览器拦截警告]
5. 发送 HTTP 请求：请求行 + 头 + 体（GET 一般无体）
   [追问：有没有命中缓存 304（ETag/Last-Modified）]
6. 服务器处理返回：状态码 + 响应头 + 响应体
   [追问：502/504 是哪一层出的问题]
7. 浏览器解析渲染：HTML → DOM 树，CSS → 样式树，
   合成渲染树 → 布局 → 绘制；JS 可阻塞解析
   [追问：什么资源会阻塞首屏渲染]
8. 连接关闭/复用：keep-alive 复用，避免下次重新握手

面试加分：把"缓存"讲透——浏览器缓存(强缓存/协商缓存)、
DNS 缓存、CDN 缓存、代理缓存，层层都有。
```
**关联项目**：通用基础、OTA 排查支持（HTTPS 通道）
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · Web 与 HTTP（端到端流程综合）

---

### HTTPS 工作原理与加密基础

**一句话要点**：HTTPS = HTTP + TLS，握手先校验证书（CA 信任链/域名/有效期）确认服务器身份，再用非对称加密（RSA/ECC）安全交换密钥，之后全部用对称加密（AES）通信；对称加密快但密钥分发难，非对称加密慢但能安全分发密钥，两者配合各取所长。

**面试怎么问**：HTTPS 握手大体流程？为什么非对称加密只用来交换密钥而不是加密全部数据？数字证书解决什么问题？

**用例 / 示例**：
```text
TLS 1.2 握手时序（标注加密阶段）：
客户端                                 服务器
 │── ClientHello(随机数A + 套件列表) ─▶│
 │◀─ ServerHello(随机数B + 选定套件) ──│   ┐
 │◀─ Certificate(证书链, 含公钥) ──────│   │ 非对称阶段
 │◀─ ServerHelloDone ─────────────────│   │ (RSA/ECC 交换密钥)
 │── 校验证书(CA信任链/域名/有效期) ──▶│   │
 │── 生成预主密钥, 用服务器公钥加密 ──▶│   │
 │── ChangeCipherSpec + Finished ────▶│   │  服务器私钥解密
 │◀─ ChangeCipherSpec + Finished ─────│   ┘
 │═══════ 此后用对称会话密钥加密 ═════▶│   ← 对称阶段(AES)
 │         （HTTP 请求/响应数据）      │

要点：
1. 非对称(公钥加密)只用于安全传递"预主密钥"——慢但安全
2. 双方用 随机数A + 随机数B + 预主密钥 算出相同会话密钥
3. 实际数据走对称加密(AES)——快，适合大流量

对称 vs 非对称：
对称加密 AES：快（吞吐高），但密钥分发难（怎么安全送达）
非对称 RSA/ECC：慢（数百倍差距），但公钥公开、私钥保密
→ 实际方案：非对称只传"会话密钥"，数据走对称加密

数字证书的作用：
1. 身份认证：证明"我是 ota.example.com"（防中间人冒充）
2. 携带公钥：客户端用公钥加密预主密钥
3. 防篡改：CA 对内容签名，改一个字节校验即失败

面试加分：中间人攻击就是"冒充服务器发自己的证书"，
客户端不校验证书链就会被骗——T-Box 必须内置 CA 根证书
并校验域名，否则 OTA 下载可被劫持注入。
```
**关联项目**：OTA 排查支持（HTTPS 通道与证书校验）、通用基础
**对应章节**：《计算机网络：自顶向下方法》第 8 章 · SSL/TLS 与密码学（对称/非对称加密、数字证书）

---

### HTTP/1.0、1.1、2.0 对比 + GET vs POST

**一句话要点**：1.0 每请求一个连接；1.1 引入持久连接、Host 字段、gzip、Cache-Control/ETag；2.0 引入多路复用（一个连接并发多个请求）、二进制帧、头部压缩 HPACK、服务器推送；GET vs POST 本质差异在语义（幂等/缓存），参数位置只是表象。

**面试怎么问**：HTTP/1.1 和 2.0 的核心区别？HTTP/2 多路复用解决了什么？GET 和 POST 到底有什么区别？

**用例 / 示例**：
```text
| 特性       | HTTP/1.0            | HTTP/1.1              | HTTP/2.0               |
|------------|---------------------|-----------------------|------------------------|
| 连接       | 每请求新建连接       | 持久连接 keep-alive   | 单连接多路复用          |
| 传输格式   | 文本                 | 文本                  | 二进制帧                |
| 队头阻塞   | 有（串行）           | 有（一个连接串行）    | 基本消除（并发流）      |
| 头部       | 简单                 | 完整                  | HPACK 压缩              |
| Host 字段  | 无（一个 IP 一个站） | 有（虚拟主机）        | 有                     |
| 缓存控制   | Expires              | Cache-Control/ETag    | 同 1.1                 |
| 推送       | 无                   | 无                    | 服务器推送（已弱化）    |
| 车联网影响 | -                    | OTA 分片下载/断点续传 | 高并发 API 更省连接      |

GET vs POST：
| 维度     | GET                          | POST                      |
|----------|------------------------------|---------------------------|
| 参数位置 | URL 查询串（?a=1&b=2）        | 请求体                    |
| 长度限制 | URL 有限制（浏览器/服务器）   | 体长度大，可传文件        |
| 缓存     | 可缓存（浏览器/CDN/代理）     | 一般不可缓存              |
| 幂等     | 是（重复请求结果相同）        | 否（重复提交会重复创建）  |
| 安全性   | 参数暴露在 URL/日志           | 参数在体内（仍建议 HTTPS）|

面试口径：GET 用于"查询"，POST 用于"提交/创建"，
语义选对了，参数位置、缓存、幂等特性自然对。
```
**关联项目**：OTA 排查支持（HTTPS 通道）、预见性巡航 PCC（HTTP 地图方案）
**对应章节**：《计算机网络：自顶向下方法》第 2 章 · Web 与 HTTP（HTTP 版本演进与请求方法）

---

### 为什么要序列化和反序列化？为什么不直接 memcpy 拷贝结构体？

**一句话要点**：序列化是把对象转成字节序列（JSON/二进制/Protobuf），反序列化是逆过程；因为网络只能传字节流、数据要持久化存储、还要跨语言跨平台，所以必须统一格式；不能直接 memcpy 结构体的原因：字节序差异（大端/小端）、内存对齐 padding 不确定、指针成员无法搬移、不同编译器/平台结构体布局不一致。

**面试怎么问**：为什么不能把结构体直接 send 出去？序列化格式怎么选（JSON vs 二进制 vs Protobuf）？什么是网络字节序？

**用例 / 示例**：
```text
序列化解决什么问题：
1. 网络只认字节流：send/recv 传的是字节，不是内存里的对象
2. 持久化：文件/数据库存的是字节序列
3. 跨语言跨平台：C 的结构体和 Java/Python 的对象不是一回事，
   统一成 JSON/Protobuf 才能互通
4. 可压缩/优化：二进制格式可压缩、可版本演进（protobuf 加字段兼容）

为什么不能直接 memcpy 结构体：
struct Msg { uint32_t len; uint16_t type; uint32_t crc; };
1. 字节序差异：
   小端机器内存: 78 56 34 12（0x12345678）
   大端机器解析: 0x78563412 → 数值完全错误
   网络传输统一用大端（网络字节序），需 htonl/ntohl 转换
2. 内存对齐 padding：
   len(4) + type(2) + 2字节填充 + crc(4) = 12 字节
   不同编译器/架构填充可能不同 → 传输长度不一致
3. 指针成员：指针存的是本进程地址，拷过去对方进程里是野指针
4. 平台布局不一致：int 在不同平台可能是 16/32 位，
   结构体字段顺序、对齐、大小都可能不同

格式选型：
JSON   可读性好、调试方便，体积大、解析慢（配置/日志类）
二进制 体积小、速度快，但字段增删不兼容（自研协议）
Protobuf 体积小、速度快、带 schema 和版本兼容（车云通信常用）
```
```text
struct Msg { uint32_t len; uint16_t type; uint32_t crc; } 的内存布局
（x86 小端，默认 4 字节对齐）：
偏移  0           4      6     8           12
     ┌──────────┬──────┬──┬──┬──────────┐
     │ len(4B)  │type(2B)│pad│  crc(4B) │
     └──────────┴──────┴──┴──┴──────────┘
                     └→ 2 字节对齐填充 padding（编译器/平台不同，不确定！）
结构体 sizeof = 12 字节（含 2 字节 padding）

序列化后的字节流（去掉 padding，按网络序大端，共 10 字节）：
len(4B) | type(2B) | crc(4B)
← 长度确定、无隐藏填充、跨平台可解析

大小端差异示例（数值 0x12345678）：
小端机器内存字节：78 56 34 12
大端机器按大端解析：0x78563412  → 数值完全错误！
→ 网络传输统一用大端（网络字节序），htonl/ntohl 转换
```
**关联项目**：云公交一体机（TCP 自定义二进制协议）、通用基础
**对应章节**：教材外补充（对应第 2 章 · 应用层协议设计，面试高频）

---

### TCP 流量控制与拥塞控制的本质区别

**一句话要点**：流量控制管"点对点"——防止发送方淹没接收方缓冲区，靠接收方通告的 rwnd（接收窗口）；拥塞控制管"全局网络"——防止注入过多数据压垮中间路由器/交换机，靠发送方自估的 cwnd（拥塞窗口），经慢启动/拥塞避免/快重传/快恢复动态调整；最终发送量 = min(rwnd, cwnd)。

**面试怎么问**：流量控制和拥塞控制有什么区别？rwnd 和 cwnd 谁说了算？为什么弱网下 cwnd 会突然掉下来？

**用例 / 示例**：
```text
三维对比表：
| 维度     | 流量控制                              | 拥塞控制                          |
|----------|---------------------------------------|-----------------------------------|
| 目的     | 点对点：防止发送过快淹没接收方缓冲区   | 全局：防止数据过多压垮中间网络设备 |
| 核心机制 | 接收窗口 rwnd：接收方在 ACK 中通告      | 拥塞窗口 cwnd：发送方自估，         |
|          | 剩余缓冲，发送方未确认数据 ≤ rwnd      | 慢启动→拥塞避免→快重传→快恢复     |
| 触发信号 | 接收方明确反馈（读取速度、缓冲空闲）   | 网络行为（超时、3 个重复 ACK、RTT 增大）|
| 作用范围 | 一条连接的两端                          | 整条路径上的所有网络节点            |
| 类比     | 水管下游水池快满了，上游放慢            | 整条管道拥堵了，大家都减速          |

最终发送窗口 = min(rwnd, cwnd)
rwnd 由对端通告（接收方决定，别人家的缓冲区）
cwnd 由本端自估（发送方决定，猜网络健不健康）

面试加分（车载弱网场景）：
隧道/地库信号差 → 丢包 → 超时触发 cwnd 骤降，
即使接收方缓冲充足（rwnd 很大）也快不起来；
所以弱网优化要"两手抓"：应用层重传/心跳 + 调低
不合理的缓冲区期待，别把 rwnd 当 cwnd 用。
```
**关联项目**：通用基础、云公交一体机（TCP 与后台平台通信）
**对应章节**：《计算机网络：自顶向下方法》第 3 章 · TCP 流量控制与拥塞控制

---

### 五种 IO 模型

**一句话要点**：IO 过程分两阶段——"等待数据就绪"和"把数据从内核拷贝到用户态"；阻塞/非阻塞看等待阶段是否让出 CPU，同步/异步看拷贝阶段由谁完成；五种模型为阻塞 IO、非阻塞 IO、多路复用（select/poll/epoll）、信号驱动 IO、异步 IO（AIO），前四种都是同步，只有 AIO 是异步。

**面试怎么问**：阻塞和非阻塞、同步和异步分别怎么区分？epoll 属于同步还是异步？为什么说异步 IO 最难用？

**用例 / 示例**：
```text
IO 两阶段（以 recv 为例）：
阶段1: 等待数据就绪（内核缓冲区有数据）
阶段2: 数据从内核拷贝到用户缓冲区（recv 返回）

四象限（阻塞/非阻塞 × 同步/异步）：
                   同步（等+拷都由应用自己来）      异步（内核全包）
  阻塞  ┌────────────────────────────────────┐  ┌──────────────────┐
        │ ①阻塞IO：进程睡到数据就绪          │  │                  │
        ├────────────────────────────────────┤  │ ⑤异步IO          │
 不阻塞  │ ②非阻塞IO：轮询检查(忙等)         │  │  (AIO/io_uring/  │
        │ ③多路复用：select/poll/epoll 等一批│  │   IOCP)：发起后   │
        │ ④信号驱动：SIGIO 通知就绪          │  │  什么都不等，内核 │
        │                                    │  │  拷贝完才通知     │
        └────────────────────────────────────┘  └──────────────────┘

五种模型要点：
① 阻塞IO      简单直观，但一个线程只能等一个 fd
② 非阻塞IO    轮询浪费 CPU，很少单独用
③ 多路复用    epoll 高效等一堆 fd，仍是同步（拷贝自己来）
④ 信号驱动    fd 就绪发 SIGIO 信号，仍要自己 recv 拷贝
⑤ 异步IO      内核完成"就绪+拷贝"才通知，应用只管结果

面试口径：epoll 是"同步非阻塞"的多路复用——
它只帮你高效地等就绪，拷贝还得自己来；
只有 AIO（Linux io_uring / Windows IOCP）才算真正的异步。
```
**关联项目**：通用基础、云公交一体机（多路 TCP 并发通道）
**对应章节**：跨领域（操作系统 · IO 多路复用，教材外补充）
