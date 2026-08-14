## 算法与手写题

> 复习策略：每天 1 题，先写思路（伪代码或画图），再写完整可编译的 C 代码；写完自查空指针、空输入、越界、循环退出条件四类边界。面试时先和面试官确认输入输出约定（如能否修改原数组、链表是否带头节点）再动手。
> 打卡节奏：第 1 周链表与栈（题 1–8），第 2 周字符串与查找（题 9–13），第 3 周排序与数组（题 14–21），第 4 周综合与查漏补缺（题 22–30）。

---

### 高频手写 30 题总清单

- [ ] 1. 单链表反转 —— 迭代三指针/递归，断链与空指针
- [ ] 2. 链表找环（快慢指针）—— Floyd 判圈，环入口求法
- [ ] 3. 合并两个有序链表 —— 哨兵节点简化头处理
- [ ] 4. 删除链表倒数第 N 个节点 —— 快慢指针 + 哑节点
- [ ] 5. 环形缓冲区 —— 嵌入式高频，头尾指针回绕与空满判断
- [ ] 6. 用两个栈实现队列 —— 入队栈 + 出队栈，倒腾时机
- [ ] 7. 括号匹配 —— 栈顶配对，空栈遇右括号
- [ ] 8. 字符串反转 —— 原地双指针
- [ ] 9. 实现 strstr —— 朴素匹配，空模式串与越界
- [ ] 10. 二分查找（含边界）—— 闭区间与 lower_bound 写法
- [ ] 11. 快速排序 —— 分区、基准选择、递归出口
- [ ] 12. 归并排序 —— 辅助数组与合并写回
- [ ] 13. 冒泡排序（含优化）—— 提前退出标志
- [ ] 14. 插入排序 —— 适合近有序数据，稳定
- [ ] 15. 选择排序 —— 不稳定，每轮找最小交换
- [ ] 16. 堆排序 —— 建堆 + 下沉调整
- [ ] 17. 求最大与次大值 —— 一次遍历两个变量
- [ ] 18. 最大子数组和（Kadane）—— 连续子数组，负数处理
- [ ] 19. 两数之和 —— 暴力 / 哈希表
- [ ] 20. 判断回文 —— 字符串与整数两种形态
- [ ] 21. 反转句子中的单词顺序 —— 先整串反转再逐词反转
- [ ] 22. 用队列实现栈 —— 两个队列轮转
- [ ] 23. 约瑟夫环 —— 模拟 / 数学递推
- [ ] 24. 求链表中点 —— 快慢指针，奇偶长度
- [ ] 25. 判断两个链表是否相交 —— 尾节点比较 / 长度对齐
- [ ] 26. 合并两个有序数组 —— 从后往前避免覆盖
- [ ] 27. 摩尔投票求众数 —— 抵消法，次数过半
- [ ] 28. 斐波那契数列 —— 迭代代替递归，防爆栈
- [ ] 29. 字符串转整数（atoi）—— 空格、符号、溢出处理
- [ ] 30. 删除有序数组重复项 —— 双指针原地

---

### 重点题详解

#### 1. 单链表反转

给定单链表头节点，返回反转后的新头节点。

**思路**：迭代法用 prev / cur / next 三个指针，每步先保存 cur 的后继再掉头，防止断链；循环结束后 prev 即新头。注意输入为空链表时直接返回 NULL，长度为 1 时返回原头。递归法以"先反转子链表"为思路，但递归深度为链表长度，长链表可能爆栈，嵌入式面试首选迭代。

**代码**：

```c
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int val;
    struct Node *next;
} Node;

/* 迭代反转：三指针逐个掉头 */
Node *reverseList(Node *head) {
    Node *prev = NULL;
    Node *cur = head;
    while (cur != NULL) {
        Node *next = cur->next;  /* 先保存后继，防止断链丢失 */
        cur->next = prev;        /* 当前节点指向前驱 */
        prev = cur;              /* 前驱后移 */
        cur = next;              /* 当前节点后移 */
    }
    return prev;                 /* 原链表尾节点成为新头 */
}
```

**复杂度**：时间 O(n)，空间 O(1)。

#### 2. 链表找环（快慢指针）

判断链表是否存在环，若有则返回环入口节点。

**思路**：慢指针每次走 1 步、快指针每次走 2 步，若存在环两者必然相遇；快指针走到 NULL 则无环。求环入口：相遇后让一个指针从头重新出发，与慢指针同速前进，再次相遇处即环入口（数学上满足"头到入口距离 = 相遇点到入口距离"）。边界：空链表、单节点无环。

**代码**：

```c
#include <stdio.h>

typedef struct Node {
    int val;
    struct Node *next;
} Node;

/* 返回环入口节点；无环返回 NULL */
Node *detectCycle(Node *head) {
    Node *slow = head, *fast = head;
    while (fast != NULL && fast->next != NULL) {
        slow = slow->next;        /* 慢指针走 1 步 */
        fast = fast->next->next;  /* 快指针走 2 步 */
        if (slow == fast) {       /* 相遇：说明存在环 */
            Node *p = head;
            while (p != slow) {   /* 同速再走，相遇点即环入口 */
                p = p->next;
                slow = slow->next;
            }
            return p;
        }
    }
    return NULL;  /* fast 触到 NULL，无环 */
}
```

**复杂度**：时间 O(n)，空间 O(1)。

#### 3. 合并两个有序链表

合并两个升序链表，返回合并后链表的头节点，要求不额外分配节点。

**思路**：用哨兵节点 dummy 统一处理头节点，避免对空链表的特判；每步取两个链表中值较小者接到 tail 后，直到一个链表为空，最后把剩余链表整体拼接。边界：两链表可能为空，哨兵节点的 next 就是结果头。

**代码**：

```c
#include <stdio.h>

typedef struct Node {
    int val;
    struct Node *next;
} Node;

Node *mergeTwoLists(Node *l1, Node *l2) {
    Node dummy = {0, NULL};   /* 栈上哨兵节点，不用 malloc */
    Node *tail = &dummy;
    while (l1 != NULL && l2 != NULL) {
        if (l1->val <= l2->val) {
            tail->next = l1;
            l1 = l1->next;
        } else {
            tail->next = l2;
            l2 = l2->next;
        }
        tail = tail->next;
    }
    /* 拼接剩余部分（最多只剩一条非空） */
    tail->next = (l1 != NULL) ? l1 : l2;
    return dummy.next;
}
```

**复杂度**：时间 O(n+m)，空间 O(1)。

#### 4. 删除链表倒数第 N 个节点

给定链表头与正整数 n，删除倒数第 n 个节点并返回新头。

**思路**：快指针先走 n 步，然后快慢指针同步前进，快指针到达尾节点时慢指针恰好停在待删节点的前驱，直接改链删除。边界：n 可能等于链表长度（删头节点），用哑节点 dummy 统一处理；n 超过长度属于输入非法，面试时先和面试官确认假设。

**代码**：

```c
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int val;
    struct Node *next;
} Node;

Node *removeNthFromEnd(Node *head, int n) {
    Node dummy = {0, head};   /* 哑节点指向头，简化删头场景 */
    Node *fast = &dummy, *slow = &dummy;

    for (int i = 0; i < n; i++) {
        fast = fast->next;    /* fast 先走 n 步 */
    }
    while (fast->next != NULL) {
        fast = fast->next;
        slow = slow->next;
    }
    Node *del = slow->next;   /* slow 的后继即待删节点 */
    slow->next = del->next;
    free(del);
    return dummy.next;
}
```

**复杂度**：时间 O(n)，空间 O(1)。

#### 5. 环形缓冲区（Ring Buffer）

用定长数组实现环形缓冲区，支持写入与读取，满时拒绝写入、空时拒绝读取。

**思路**：三个状态量 head（读）、tail（写）、count（元素个数），count 同时区分空与满，避免"满"与"空"下标相同的问题；指针移动用取模回绕。边界：读写前必须检查 count；缓冲区大小为 1 时也要正确。嵌入式场景常配合中断与临界区，面试可补充"单生产者单消费者可用原子变量免加锁"。

**代码**：

```c
#include <stdint.h>
#include <stdbool.h>

#define BUF_SIZE 16

typedef struct {
    uint8_t data[BUF_SIZE];
    int head;    /* 读指针（下一个读出位置） */
    int tail;    /* 写指针（下一个写入位置） */
    int count;   /* 当前元素个数，用于区分空与满 */
} RingBuf;

void rb_init(RingBuf *rb) {
    rb->head = 0;
    rb->tail = 0;
    rb->count = 0;
}

bool rb_is_empty(const RingBuf *rb) { return rb->count == 0; }
bool rb_is_full(const RingBuf *rb)  { return rb->count == BUF_SIZE; }

/* 写入一字节，满则返回 false */
bool rb_write(RingBuf *rb, uint8_t byte) {
    if (rb_is_full(rb)) return false;
    rb->data[rb->tail] = byte;
    rb->tail = (rb->tail + 1) % BUF_SIZE;  /* 环形回绕 */
    rb->count++;
    return true;
}

/* 读出一字节，空则返回 false */
bool rb_read(RingBuf *rb, uint8_t *byte) {
    if (rb_is_empty(rb)) return false;
    *byte = rb->data[rb->head];
    rb->head = (rb->head + 1) % BUF_SIZE;
    rb->count--;
    return true;
}
```

**复杂度**：时间 O(1)（读写都是常数操作），空间 O(BUF_SIZE)。

#### 6. 用两个栈实现队列

仅用两个栈实现队列的入队、出队、判空，要求先进先出。

**思路**：栈是后进先出，两次"后进先出"叠加即"先进先出"。入队一律压入 in 栈；出队时若 out 栈为空，把 in 栈元素全部弹出压入 out（顺序被反转），再从 out 弹出。边界：出队前必须判空；out 非空时直接弹出，不必反复倒腾。

**代码**：

```c
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

typedef struct {
    int *data;
    int top;   /* 栈顶下标，-1 表示空 */
    int cap;
} Stack;

Stack *stack_create(int cap) {
    Stack *s = (Stack *)malloc(sizeof(Stack));
    s->data = (int *)malloc(sizeof(int) * cap);
    s->top = -1;
    s->cap = cap;
    return s;
}

void stack_push(Stack *s, int v) { s->data[++s->top] = v; }
int  stack_pop(Stack *s)         { return s->data[s->top--]; }
bool stack_empty(const Stack *s) { return s->top == -1; }

/* 队列：in 负责入队，out 负责出队 */
typedef struct {
    Stack *in;
    Stack *out;
} Queue;

Queue *queue_create(int cap) {
    Queue *q = (Queue *)malloc(sizeof(Queue));
    q->in  = stack_create(cap);
    q->out = stack_create(cap);
    return q;
}

void queue_push(Queue *q, int v) {
    stack_push(q->in, v);
}

int queue_pop(Queue *q) {
    if (stack_empty(q->out)) {
        /* out 空了才把 in 全部倒过来，摊还 O(1) */
        while (!stack_empty(q->in)) {
            stack_push(q->out, stack_pop(q->in));
        }
    }
    return stack_pop(q->out);
}

bool queue_empty(const Queue *q) {
    return stack_empty(q->in) && stack_empty(q->out);
}
```

**复杂度**：入队 O(1)；出队均摊 O(1)（每个元素最多被搬运两次）。空间 O(n)。

#### 7. 括号匹配

给定只含 `( ) [ ] { }` 的字符串，判断括号是否成对且顺序正确。

**思路**：遇到左括号入栈，遇到右括号先判栈空（空则必然不匹配），再与栈顶左括号比对类型，不配对直接返回 false；其他字符跳过。边界：遍历完栈必须为空；只含左括号、右括号开头的输入都要覆盖。

**代码**：

```c
#include <stdbool.h>

/* 判断括号是否完全匹配；非括号字符忽略 */
bool isBalanced(const char *s) {
    if (s == NULL) return false;

    char stack[1024];   /* 简化：假设长度上限 1024 */
    int top = -1;

    for (int i = 0; s[i] != '\0'; i++) {
        char c = s[i];
        if (c == '(' || c == '[' || c == '{') {
            stack[++top] = c;               /* 左括号入栈 */
        } else if (c == ')' || c == ']' || c == '}') {
            if (top < 0) return false;      /* 右括号但栈空：不匹配 */
            char left = stack[top--];
            if ((c == ')' && left != '(') ||
                (c == ']' && left != '[') ||
                (c == '}' && left != '{')) {
                return false;               /* 类型不配对 */
            }
        }
        /* 其他字符直接跳过 */
    }
    return top == -1;   /* 结束时栈空才算完全匹配 */
}
```

**复杂度**：时间 O(n)，空间 O(n)（栈深最多 n）。

#### 8. 字符串反转

原地反转 C 字符串（不含 `\0`），不借助额外数组。

**思路**：双指针一头一尾向中间靠拢并交换字符。边界：空串、单字符串不进入循环直接返回；注意先求长度再定位尾字符，`\0` 不能参与交换；入参为 NULL 时防御性返回。

**代码**：

```c
#include <stdio.h>
#include <string.h>

/* 原地反转字符串 s（修改原串） */
void reverseString(char *s) {
    if (s == NULL) return;              /* 空指针防御 */
    int i = 0;
    int j = (int)strlen(s) - 1;
    while (i < j) {                     /* 中间相遇即结束 */
        char tmp = s[i];
        s[i] = s[j];
        s[j] = tmp;
        i++;
        j--;
    }
}
```

**复杂度**：时间 O(n)，空间 O(1)。

#### 9. 实现 strstr

在字符串 haystack 中查找子串 needle 首次出现的位置，返回指向该位置的指针，找不到返回 NULL。

**思路**：朴素匹配，外层遍历 haystack 每个可能起点，内层逐字符比较；匹配成功需 needle 到达 `\0`。边界：needle 为空串时按 C 标准返回 haystack；比较时利用 `haystack[i+j] != '\0'` 短路防止越界读；haystack 为 NULL 防御返回。

**代码**：

```c
#include <stdio.h>

/* 在 haystack 中查找 needle，返回首次出现位置，未找到返回 NULL */
char *my_strstr(const char *haystack, const char *needle) {
    if (haystack == NULL) return NULL;
    if (needle == NULL || needle[0] == '\0') return (char *)haystack; /* 空模式串 */

    for (int i = 0; haystack[i] != '\0'; i++) {
        int j = 0;
        /* 逐个比较；haystack 先到 \0 时条件短路，不会越界 */
        while (needle[j] != '\0' &&
               haystack[i + j] != '\0' &&
               haystack[i + j] == needle[j]) {
            j++;
        }
        if (needle[j] == '\0') return (char *)(haystack + i); /* 完全匹配 */
    }
    return NULL;  /* 未找到 */
}
```

**复杂度**：最坏时间 O(n·m)（n 为主串长、m 为模式串长），空间 O(1)。面试可补充 KMP 将时间优化到 O(n+m)。

#### 10. 二分查找（含边界）

在升序数组中查找目标值下标；并给出 lower_bound（第一个 >= target 的位置）写法。

**思路**：二分的关键是区间定义一致。闭区间写法 `[lo, hi]` 循环条件 `lo <= hi`，中点用 `lo + (hi - lo)/2` 防溢出；lower_bound 用左闭右开 `[lo, hi)`，循环条件 `lo < hi`，`a[mid] < target` 时收缩左边界，否则收缩右边界。边界：空数组、target 小于首元素、大于末元素、重复元素都要验证。

**代码**：

```c
#include <stdio.h>

/* 标准二分查找：返回 target 下标，找不到返回 -1 */
int binarySearch(int a[], int n, int target) {
    int lo = 0, hi = n - 1;             /* 闭区间 [lo, hi] */
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;   /* 防止 lo+hi 溢出 */
        if (a[mid] == target) {
            return mid;
        } else if (a[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return -1;
}

/* lower_bound：第一个 >= target 的下标，全部小于则返回 n */
int lowerBound(int a[], int n, int target) {
    int lo = 0, hi = n;                 /* 左闭右开 [lo, hi) */
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid;                   /* mid 可能是答案，不排除 */
        }
    }
    return lo;
}
```

**复杂度**：时间 O(log n)，空间 O(1)。

#### 11. 快速排序

对 int 数组升序排序。

**思路**：选基准（此处取最右元素），一趟分区把小于基准的放左边、大于的放右边，基准归位后递归两侧。边界：递归出口 `lo >= hi`（空区间或单元素）；已有序或全相同数组时递归深度退化到 O(n)，面试可提三数取中、随机基准优化；注意分区循环下标从 lo 到 hi-1。

**代码**：

```c
#include <stdio.h>

/* 分区：以 a[hi] 为基准，返回基准最终下标 */
static int partition(int a[], int lo, int hi) {
    int pivot = a[hi];
    int i = lo - 1;                     /* i 指向最后一个 <= pivot 的位置 */
    for (int j = lo; j < hi; j++) {
        if (a[j] < pivot) {
            i++;
            int tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
    }
    /* 基准归位到 i+1 */
    int tmp = a[i + 1]; a[i + 1] = a[hi]; a[hi] = tmp;
    return i + 1;
}

static void quickSortRec(int a[], int lo, int hi) {
    if (lo >= hi) return;               /* 递归出口 */
    int p = partition(a, lo, hi);
    quickSortRec(a, lo, p - 1);
    quickSortRec(a, p + 1, hi);
}

/* 对外接口：quick_sort(a, n) */
void quick_sort(int a[], int n) {
    if (a == NULL || n <= 1) return;
    quickSortRec(a, 0, n - 1);
}
```

**复杂度**：平均时间 O(n log n)，最坏 O(n²)（已有序且基准取端点时）；空间平均 O(log n)（递归栈）。

#### 12. 归并排序

对 int 数组升序排序。

**思路**：分治——递归拆成两半，分别排好后线性合并。合并时用临时数组按大小依次取元素，结束后写回原数组。边界：递归出口 `lo >= hi`；mid 用 `lo + (hi-lo)/2` 防溢出；malloc 失败时直接返回，保持原数组不变。归并稳定，适合链表与外部排序，但需要 O(n) 辅助空间。

**代码**：

```c
#include <stdio.h>
#include <stdlib.h>

/* 合并两个有序区间 [lo,mid] 与 [mid+1,hi] */
static void merge(int a[], int tmp[], int lo, int mid, int hi) {
    int i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) {       /* 谁小先取谁 */
        if (a[i] <= a[j]) tmp[k++] = a[i++];
        else              tmp[k++] = a[j++];
    }
    while (i <= mid) tmp[k++] = a[i++]; /* 左半剩余 */
    while (j <= hi)  tmp[k++] = a[j++]; /* 右半剩余 */
    for (k = lo; k <= hi; k++) a[k] = tmp[k]; /* 写回原数组 */
}

static void mergeSortRec(int a[], int tmp[], int lo, int hi) {
    if (lo >= hi) return;               /* 单元素或空区间 */
    int mid = lo + (hi - lo) / 2;
    mergeSortRec(a, tmp, lo, mid);
    mergeSortRec(a, tmp, mid + 1, hi);
    merge(a, tmp, lo, mid, hi);
}

/* 对外接口：merge_sort(a, n) */
void merge_sort(int a[], int n) {
    if (a == NULL || n <= 1) return;
    int *tmp = (int *)malloc(sizeof(int) * n);
    if (tmp == NULL) return;            /* 内存不足，保持原数组 */
    mergeSortRec(a, tmp, 0, n - 1);
    free(tmp);
}
```

**复杂度**：时间 O(n log n)（任何输入都稳定），空间 O(n)（辅助数组 + 递归栈 O(log n)）。

#### 13. 大数运算

有两个大数 `unsigned char M[128]` 和 `unsigned char N[128]`（大端格式存储），先将 M 乘 4、N 乘 2，再求两者之和，结果同样按大端存满 128 字节。

**思路**：大端存储下最高有效字节在 data[0]、最低有效字节（个位）在 data[SIZE-1]，运算必须从数组末尾向前推进。乘 2 等价于整体左移 1 位：从最低字节开始，把本字节移出的最高位作为进位传给更高字节；乘 4 就是左移 2 次。大数加法从最低字节开始逐字节相加，和超过 255 时向高字节进位 1。边界：移位/加法的最高位进位超出 128 字节时直接丢弃（数值溢出由上层约定）；全 0 数组运算结果仍为 0。

**代码**：

```c
#include <stdio.h>

#define SIZE 128   /* 大数占用字节数 */

/* 大端约定：data[0] 为最高字节，data[SIZE-1] 为最低字节（个位） */

/* 大数左移 1 位（等价于乘 2），最高位溢出的 1 直接丢弃 */
void shiftLeftOne(unsigned char *num) {
    int carry = 0;                        /* 上一字节移出的最高位 */
    for (int i = SIZE - 1; i >= 0; i--) { /* 从最低字节向前处理 */
        int newCarry = (num[i] & 0x80) ? 1 : 0; /* 本字节最高位移出 */
        num[i] = (unsigned char)((num[i] << 1) | carry);
        carry = newCarry;
    }
    /* 循环结束后最高字节的溢出位已丢弃 */
}

/* 大数左移 bits 位（乘 2^bits），乘 4 即调用 2 次 */
void shiftLeft(unsigned char *num, int bits) {
    for (int i = 0; i < bits; i++) {
        shiftLeftOne(num);
    }
}

/* 大数加法：sum = a + b（结果覆盖写回 sum），最高位进位丢弃 */
void bigAdd(const unsigned char *a, const unsigned char *b, unsigned char *sum) {
    int carry = 0;
    for (int i = SIZE - 1; i >= 0; i--) { /* 从最低字节逐字节相加 */
        int v = a[i] + b[i] + carry;
        sum[i] = (unsigned char)(v & 0xFF);
        carry = v >> 8;                   /* 超过 255 则向高字节进位 1 */
    }
}

int main(void) {
    unsigned char M[SIZE] = {0};
    unsigned char N[SIZE] = {0};
    unsigned char result[SIZE] = {0};

    /* 示例：M = 0x1234，N = 0x000F（大端：最低字节在末尾） */
    M[SIZE - 1] = 0x34;
    M[SIZE - 2] = 0x12;
    N[SIZE - 1] = 0x0F;

    shiftLeft(M, 2);     /* M *= 4  -> 0x48D0 */
    shiftLeft(N, 1);     /* N *= 2  -> 0x001E */
    bigAdd(M, N, result);/* result = 0x48EE */

    /* 打印结果，跳过前导 0 字节 */
    int i = 0;
    while (i < SIZE - 1 && result[i] == 0) {
        i++;
    }
    printf("result = 0x");
    for (; i < SIZE; i++) {
        printf("%02X", result[i]);
    }
    printf("\n");
    return 0;
}
```

**复杂度**：移位 O(128·bits)，加法 O(128)，均与数值大小无关，只取决于固定字节数；空间 O(1)（不含输入输出数组本身）。

#### 14. 冒泡排序（含优化）

对 int 数组升序排序，要求某轮无交换时提前退出。

**思路**：相邻两两比较，前者大于后者就交换，每轮结束把当前最大值"冒泡"到末尾。优化：若某一轮没有任何交换，说明数组已经有序，直接结束。边界：空数组、单元素数组直接返回；内层循环上界 `n - 1 - i` 使已就位的尾部元素不再参与比较。

**代码**：

```c
#include <stdio.h>
#include <stdbool.h>

/* 冒泡排序（升序）：大数逐轮后移；某轮无交换说明已有序，提前退出 */
void bubble_sort(int a[], int n) {
    if (a == NULL || n <= 1) return;          /* 空数组/单元素直接返回 */
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;                 /* 本轮是否有交换 */
        for (int j = 0; j < n - 1 - i; j++) { /* 末尾 i 个元素已就位 */
            if (a[j] > a[j + 1]) {
                int tmp = a[j];
                a[j] = a[j + 1];
                a[j + 1] = tmp;
                swapped = true;
            }
        }
        if (!swapped) break;                  /* 优化：已有序，提前退出 */
    }
}
```

**复杂度**：平均/最坏 O(n²)，最好 O(n)（已有序时一轮即退出）；空间 O(1)；稳定（相等元素不交换）。

#### 15. 选择排序

对 int 数组升序排序。

**思路**：每轮在未排序区间中扫描找出最小值，与区间第一个元素交换，区间边界前移。比较次数固定为 n(n-1)/2，与输入顺序无关。边界：内层从 i+1 开始；minIdx 初始化取 i，只有找到更小值才交换，避免无意义交换。

**代码**：

```c
#include <stdio.h>

/* 选择排序（升序）：每轮选出未排序区间的最小值，交换到区间开头 */
void selection_sort(int a[], int n) {
    if (a == NULL || n <= 1) return;
    for (int i = 0; i < n - 1; i++) {
        int minIdx = i;                       /* 假设当前元素最小 */
        for (int j = i + 1; j < n; j++) {
            if (a[j] < a[minIdx]) {
                minIdx = j;                   /* 记录更小值下标 */
            }
        }
        if (minIdx != i) {                    /* 交换到未排序区间最前 */
            int tmp = a[i];
            a[i] = a[minIdx];
            a[minIdx] = tmp;
        }
    }
}
```

**复杂度**：最好/最坏/平均均为 O(n²)（比较次数固定）；空间 O(1)；不稳定（相等元素可能因交换改变相对顺序）。

#### 16. 插入排序

对 int 数组升序排序。

**思路**：把数组看成"左侧已排序 + 右侧未排序"两部分，每轮取未排序区间的第一个元素 key，从后往前扫描已排序区间，比 key 大的元素逐个后移，找到位置后插入 key。边界：key 若比已排序区间所有元素都小，会移到最前（j 到 -1 退出循环）；注意后移覆盖前必须先保存 key。

**代码**：

```c
#include <stdio.h>

/* 插入排序（升序）：将 key 插入左侧有序区间的正确位置 */
void insertion_sort(int a[], int n) {
    if (a == NULL || n <= 1) return;
    for (int i = 1; i < n; i++) {
        int key = a[i];                       /* 待插入元素，先保存 */
        int j = i - 1;
        while (j >= 0 && a[j] > key) {        /* 从后往前扫描，大的后移 */
            a[j + 1] = a[j];
            j--;
        }
        a[j + 1] = key;                       /* 插入正确位置 */
    }
}
```

**复杂度**：平均/最坏 O(n²)，最好 O(n)（已有序时每个 key 只比较一次）；空间 O(1)；稳定。适合数据量小或近有序的场景。

#### 17. 希尔排序

对 int 数组升序排序（缩小增量排序）。

**思路**：先取较大间隔 gap 把数组分成若干子序列，各自做插入排序，再逐步缩小 gap 直到 1，最后一轮就是普通插入排序。好处是让元素能跨大步快速接近目标位置，减少插入排序的总移动量。边界：gap 序列从 n/2 开始每次减半直到 1；内层比较时下标要保证 `j >= gap` 防止越界。

**代码**：

```c
#include <stdio.h>

/* 希尔排序（升序）：按间隔 gap 分组做插入排序，gap 逐步缩小到 1 */
void shell_sort(int a[], int n) {
    if (a == NULL || n <= 1) return;
    for (int gap = n / 2; gap > 0; gap /= 2) {   /* 增量序列：n/2, n/4, ..., 1 */
        for (int i = gap; i < n; i++) {          /* 对每组子序列做插入排序 */
            int key = a[i];
            int j = i;
            while (j >= gap && a[j - gap] > key) {
                a[j] = a[j - gap];               /* 间隔 gap 的元素后移 */
                j -= gap;
            }
            a[j] = key;
        }
    }
}
```

**复杂度**：平均约 O(n^1.3)（依赖增量序列），最坏 O(n²)；空间 O(1)；不稳定（跨间隔移动可能打乱相等元素相对顺序）。

---

### 排序算法复杂度与稳定性总表

| 排序算法 | 平均时间 | 最坏时间 | 最好时间 | 空间 | 稳定性 |
| --- | --- | --- | --- | --- | --- |
| 冒泡排序 | O(n²) | O(n²) | O(n) | O(1) | 稳定 |
| 选择排序 | O(n²) | O(n²) | O(n²) | O(1) | 不稳定 |
| 插入排序 | O(n²) | O(n²) | O(n) | O(1) | 稳定 |
| 希尔排序 | O(n^1.3) 左右 | O(n²) | O(n) | O(1) | 不稳定 |
| 归并排序 | O(n log n) | O(n log n) | O(n log n) | O(n) | 稳定 |
| 快速排序 | O(n log n) | O(n²) | O(n log n) | O(log n) | 不稳定 |
| 堆排序 | O(n log n) | O(n log n) | O(n log n) | O(1) | 不稳定 |
| 计数排序 | O(n + k) | O(n + k) | O(n + k) | O(k) | 稳定 |
| 桶排序 | O(n + k) | O(n²) | O(n) | O(n + k) | 稳定 |
| 基数排序 | O(d·(n + k)) | O(d·(n + k)) | O(d·(n + k)) | O(n + k) | 稳定 |

> 稳定性含义：排序前键值相等的两个元素，排序后它们的相对顺序保持不变（如按成绩排序后，同分者仍按原先后顺序排列）。稳定排序：冒泡、插入、归并、计数、桶、基数；不稳定排序：选择、希尔、快排、堆。稳定性在"先按 A 排序再按 B 排序"的多关键字场景中很关键。

### 各排序最好/最坏情况分析（重点快排）

- **冒泡排序**：最好 O(n)——数组已有序，第一轮无交换即提前退出；最坏 O(n²)——逆序，每轮都要完成全部比较与交换。
- **插入排序**：最好 O(n)——已有序，每个 key 只比较一次即就位；最坏 O(n²)——逆序，每个元素都要移动到最前。
- **选择排序**：最好 = 最坏 = O(n²)——无论输入如何，每轮都必须完整扫描未排序区间找最小值，比较次数固定为 n(n-1)/2。
- **快速排序（重点）**：最好/平均 O(n log n)——每次分区都能把区间一分为二，递归深度 log n；最坏 O(n²)——每次分区都极度不均（递归深度退化到 n）。
  - **最坏情况成因**：基准每次都选到当前区间的最大或最小值，如"已有序数组 + 固定取端点作基准"，此时一侧始终为空，另一侧始终是 n-1，退化为冒泡级别的复杂度。
  - **优化手段**：① 随机选取基准，从概率上消除对特定输入的依赖；② 三数取中（取 lo、mid、hi 三个位置的中值作基准），对已有序/近有序数组效果明显；③ 区间很小时改用插入排序，减少递归与分区开销；④ 与基准相等的元素集中处理（三路快排），缓解大量重复元素场景。
- **归并排序**：最好 = 最坏 = O(n log n)——无论输入如何都严格拆半再合并，比较次数稳定；代价是需要 O(n) 辅助空间。
- **堆排序**：最好 = 最坏 = O(n log n)——建堆 O(n)，之后 n 次下沉每次 O(log n)；原地排序，但跳跃访问缓存不友好，常数较大。
- **计数/桶/基数排序（非比较排序简述）**：计数排序 O(n + k)，k 为数据值域范围，适合值域小、数据量大；桶排序平均 O(n + k)，最坏 O(n²)（所有元素落入同一个桶退化为内部排序），适合数据分布均匀的场景；基数排序 O(d·(n + k))，d 为位数，按位从低到高做稳定排序。三者都以额外空间换时间，仅适用于特定数据形态，嵌入式面试提一句原理即可。
