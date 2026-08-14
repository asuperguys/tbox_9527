## C++ 面试题

> 车联网 / 中间件 / 通信网关岗位大量使用 C++，嵌入式面试中 C++ 是"加分项"更是"减分项"：只会 C 会明显减分，而 C++11 现代特性（智能指针、移动语义、lambda）是高频考点。以下按面试频率精选 17 个知识点，覆盖语言特性、内存管理、设计模式与手写代码四大类，全部可在面试中当场讲清。

### 1. 面向对象三大特性：封装 / 继承 / 多态

**一句话要点**：封装隐藏内部实现、继承实现代码复用、多态让"同一接口、不同实现"；多态成立必须同时满足三个条件——虚函数、派生类重写、基类指针/引用调用。

**面试怎么问**："C++ 三大特性是什么？多态成立的条件？""重载（overload）和重写（override）有什么区别？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

class Shape {
public:
    virtual void draw() const {          // 虚函数：构成多态的关键
        cout << "draw Shape" << endl;
    }
    virtual ~Shape() {}                  // 基类析构必须 virtual，见知识点 3
};

class Circle : public Shape {
public:
    void draw() const override {         // override：显式声明重写，编译期检查
        cout << "draw Circle" << endl;
    }
};

class Rectangle : public Shape {
public:
    void draw() const override {
        cout << "draw Rectangle" << endl;
    }
};

// 多态三条件：虚函数 + 重写 + 基类指针/引用调用
Shape* s = new Circle();
s->draw();          // 运行期输出 draw Circle（动态绑定）
delete s;
```

**关联场景**：车联网中间件——协议解析（CAN / MQTT / HTTP）抽象成统一接口，各协议子类重写解析方法，上层只依赖基类。

---

### 2. 多态的实现原理：虚函数表 vtable / 虚指针 vptr / 动态绑定

**一句话要点**：类中只要有虚函数，编译器就为它生成一张虚函数表 vtable（存函数指针），每个对象首部藏一个虚指针 vptr 指向该表；基类指针调用虚函数时通过 vptr 查表定位真实函数，编译期不确定、运行期才决定，这就是动态绑定。

**面试怎么问**："多态底层的 vptr 存在对象的什么位置？""一个含两个虚函数的类，对象占多大？""调用虚函数比普通函数慢在哪？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

class Animal {
public:
    virtual void speak() { cout << "animal" << endl; }
    virtual void run()   { cout << "running" << endl; }
    int age;             // 普通成员变量
};

class Dog : public Animal {
public:
    void speak() override { cout << "wang!" << endl; }   // 重写 speak
};

Animal* a = new Dog();
a->speak();    // 输出 wang!：vptr 指向 Dog 的虚表，动态绑定到 Dog::speak
delete a;
```

内存布局（64 位下，含虚函数的对象首部放 vptr）：

```
Dog 对象内存：
┌─────────────┐
│ vptr ───────┼──────→ Dog 的 vtable
├─────────────┤        ┌─────────────────────┐
│ age (4B)    │        │ [0] Dog::speak      │   ← 重写后指向派生类
└─────────────┘        │ [1] Animal::run     │   ← 未重写仍指向基类
                       └─────────────────────┘

a->speak() 等价于：
(*(a->vptr)[0])(a)      // 取 vptr → 按槽位取函数指针 → 传 this 调用
```

**关联场景**：通用——面试常追问"多态开销"，答：一次间接寻址 + 无法内联，性能敏感热路径（如高频 CAN 报文解析）可考虑用 switch 替代虚函数。

---

### 3. 虚析构函数：为什么基类析构必须 virtual

**一句话要点**：用基类指针 delete 派生类对象时，若基类析构不是虚函数，只会调用基类析构，派生类部分（如堆内存成员）不会被释放，造成资源泄漏；声明 virtual 后析构沿虚表动态绑定到派生类析构，派生类析构结束会自动调用基类析构。

**面试怎么问**："为什么基类析构函数要加 virtual？不加会怎样？""派生类析构函数会自动调用基类析构吗？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    Base() { m_p = new int(1); }
    virtual ~Base() {              // 加 virtual：delete 基类指针时正确释放
        delete m_p;
        cout << "~Base" << endl;
    }
private:
    int* m_p;
};

class Derived : public Base {
public:
    Derived() { m_q = new int(2); }
    ~Derived() override {          // 析构函数重写，先析构派生类
        delete m_q;
        cout << "~Derived" << endl;
    }
private:
    int* m_q;
};

Base* p = new Derived();
delete p;
// 基类析构为 virtual：输出 ~Derived 再 ~Base，m_q 正确释放
// 若去掉 virtual：只调用 ~Base，Derived 的 m_q 泄漏（且行为未定义）
```

**关联场景**：通用——所有准备被继承的类（基类、接口类）析构一律声明 virtual；纯接口类可用纯虚析构并给空实现。

---

### 4. 值传递 / 引用传递 / 指针传递的区别

**一句话要点**：值传递拷贝实参、改的是副本；引用和指针都直接操作实参，区别在于引用不可为空、必须初始化、不能改指向；大对象传参用 const 引用避免拷贝开销。

**面试怎么问**："三个传参方式有什么区别？什么时候用 const 引用？""引用和指针做形参哪个好？"

**用例 / 示例**：

```cpp
void byValue(int x) { x = 100; }    // 拷贝一份，函数内改的是副本
void byRef(int& x)   { x = 100; }   // 直接操作实参
void byPtr(int* x)   { *x = 100; }  // 通过地址操作实参

int a = 1;
byValue(a);   // a 仍为 1
byRef(a);     // a 变为 100
byPtr(&a);    // a 变为 100

// const 引用：既避免拷贝，又保证不修改实参 —— 大对象传参首选
void dump(const std::string& s);   // 不拷贝整个 string
// 如果传值：每次调用都会深拷贝字符串，性能差
```

**关联场景**：车联网中间件——报文、配置结构体等大对象传参一律 const 引用，避免无谓拷贝；输出型参数用引用或指针。

---

### 5. 指针 vs 引用

**一句话要点**：指针可空、可改指向、sizeof 得到指针本身大小、++ 是地址步进；引用是别名，必须初始化、不可为空、不能改指向、sizeof 得到被引用对象大小、++ 是对象自增；引用本质是常指针，可互相转换。

**面试怎么问**："指针和引用有什么区别？""sizeof(指针) 和 sizeof(引用) 分别是多少？""引用能不能改变指向？"

**用例 / 示例**：

```cpp
int a = 1, b = 2;

int* p = &a;        // 指针：可以为空，可以改变指向
p = &b;             // 合法：p 改指 b
p = nullptr;        // 合法：空指针

int& r = a;         // 引用：必须初始化，不可为空，不可改指向
r = b;              // 不是让 r 指向 b，而是 a = b，a 变为 2

sizeof(p);          // 8（64 位平台）：指针变量本身大小
sizeof(r);          // 4：r 是 a 的别名，等于 a 的大小

++p;                // 指针后移一个 int（地址 +4），指向下一个元素
++r;                // a 的值 +1

// 互相转换
int* p2 = &r;       // 引用 → 指针：取地址
int& r2 = *p;       // 指针 → 引用：解引用
```

**关联场景**：通用——接口传参偏好引用（安全），实现链表、回调、可选参数用指针。

---

### 6. 深拷贝 vs 浅拷贝

**一句话要点**：默认拷贝构造函数是浅拷贝——只复制指针值，两个对象指向同一块堆内存，析构时二次释放（双重释放/悬垂指针）；含指针成员的类必须实现深拷贝：自定义拷贝构造函数和赋值运算符，重新分配内存并复制内容。

**面试怎么问**："浅拷贝有什么问题？""深拷贝要重写哪两个函数？""赋值运算符要注意什么？"

**用例 / 示例**：

```cpp
class String {
public:
    String(const char* s) {
        m_len = strlen(s);
        m_p = new char[m_len + 1];
        strcpy(m_p, s);
    }
    // 不写拷贝构造 → 默认浅拷贝：
    // String b = a; 后 b.m_p 与 a.m_p 指向同一块内存
    // 两者析构时都 delete[] 同一地址 → 双重释放，程序崩溃

    // 深拷贝：拷贝构造函数
    String(const String& other) {
        m_len = other.m_len;
        m_p = new char[m_len + 1];     // 重新分配内存
        strcpy(m_p, other.m_p);        // 复制内容
    }

    // 深拷贝：赋值运算符（注意自赋值检查）
    String& operator=(const String& other) {
        if (this != &other) {          // 防自赋值：a = a
            delete[] m_p;              // 先释放旧资源
            m_len = other.m_len;
            m_p = new char[m_len + 1];
            strcpy(m_p, other.m_p);
        }
        return *this;
    }

    ~String() { delete[] m_p; }
private:
    char* m_p;
    int m_len;
};
```

**关联场景**：通用——凡是类里有 new 出来的成员（缓冲区、协议包、队列节点）都要深拷贝三件套：拷贝构造 + 赋值 + 析构（三法则）。

---

### 7. 构造函数与析构函数要点

**一句话要点**：const 和引用成员必须在初始化列表初始化；构造顺序是"基类 → 成员 → 自身构造体"（析构严格相反）；拷贝构造在传值、返回对象、用一个对象初始化另一个对象时触发。

**面试怎么问**："为什么 const 成员必须用初始化列表？""构造和析构的顺序是什么？""哪些场景会触发拷贝构造？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    Base() { cout << "Base" << endl; }
    ~Base() { cout << "~Base" << endl; }
};

class Derived : public Base {
public:
    // const/引用成员只能在初始化列表初始化，不能先默认构造再赋值
    Derived(int v) : m_const(v), m_ref(m_data) {
        m_data = v;
        cout << "Derived" << endl;
    }
    ~Derived() { cout << "~Derived" << endl; }
private:
    const int m_const;   // 必须初始化列表
    int& m_ref;          // 必须初始化列表
    int m_data;
};

// 触发拷贝构造的三种典型场景：
String a("hello");
String b = a;            // ① 用一个对象初始化另一个
void f(String s);        // ② 传值入参时拷贝（可改 const& 避免）
String g() { return a; } // ③ 返回对象（RVO 优化下可能不拷贝）
```

**关联场景**：通用——问"new 一个派生类时打印顺序"是高频变形题：先 Base 构造、再 Derived 构造、delete 时先 ~Derived 再 ~Base。

---

### 8. new 的实现原理

**一句话要点**：`new T` 分两步——`operator new` 分配内存（内部调用 malloc），再在该内存上调用构造函数（placement new）；所以 new 与 malloc 的核心区别是触发构造/析构；`new[]` 必须配 `delete[]`。

**面试怎么问**："new 和 malloc 有什么区别？""new 的底层是怎么实现的？""为什么 new[] 要配 delete[]？"

**用例 / 示例**：

```cpp
// new 的完整过程（两步）：
T* p = new T(1);
// 等价于：
void* mem = operator new(sizeof(T));  // ① 分配内存，底层调 malloc
T* p = new (mem) T(1);                // ② placement new：在内存上调用构造函数

// 配对规则（不配对是未定义行为）：
T* p   = new T;         delete p;         // ✔ 正确配对
T* arr = new T[10];     delete[] arr;     // ✔ 必须 delete[]，数组头记录了元素个数
// 错误：new[] 配 delete → 只析构第一个元素甚至崩溃

// new vs malloc 对照：
// new 类型安全（返回 T*）          malloc 返回 void*，要强转
// new 触发构造函数/析构函数         malloc 只分内存
// new 失败抛 std::bad_alloc        malloc 失败返回 NULL
// operator new 可重载/类内重载     malloc 不可重载
// new 无需计算字节数                malloc 要手动 sizeof
```

**关联场景**：通用——追问"能不能用 malloc 代替 new"必答"不能，不触发构造"；嵌入式里 operator new 可重载为池化分配，减少碎片。

---

### 9. C++11 新特性总览

**一句话要点**：C++11 是最重要的现代标准，高频考点九个：auto 类型推导、nullptr、智能指针、lambda、右值引用/移动语义、范围 for、override/final、enum class、std::thread。

**面试怎么问**："C++11 你熟悉哪些新特性？挑两个讲讲？""项目里用了哪些 C++11 特性？"

**用例 / 示例**：

```cpp
auto i = 42;                       // ① auto 类型推导
int* p = nullptr;                  // ② nullptr 代替 NULL（NULL 实为 0，有歧义）
std::unique_ptr<int> up(new int);  // ③ 智能指针：unique/shared/weak
auto f = [](int x) { return x * 2; }; // ④ lambda 匿名函数
std::string s2 = std::move(s1);    // ⑤ 右值引用 / 移动语义，见知识点 16
for (auto& x : vec) { x++; }       // ⑥ 范围 for，免下标
void draw() override;              // ⑦ override 显式重写 / final 禁止重写
enum class Color { Red, Green };   // ⑧ 强类型枚举，不隐式转 int
std::thread t(worker, arg);        // ⑨ 标准线程库，配合 mutex
t.join();
```

**关联场景**：车联网中间件——服务端 C++ 项目普遍要求 C++11/17，智能指针管理连接对象、lambda 做回调（MQTT 消息处理、定时器）是日常写法。

---

### 10. auto 关键字

**一句话要点**：auto 由初始化表达式推导类型；与 decltype 的区别是 auto 推导的是"值类型"（去掉引用和顶层 const），decltype 保留表达式的完整类型且不求值；auto 不能用于函数参数（C++20 前）和数组定义。

**面试怎么问**："auto 和 decltype 有什么区别？""auto 有什么限制？""auto 会不会去掉引用和 const？"

**用例 / 示例**：

```cpp
auto x = 42;          // x 推导为 int
auto y = 3.14;        // y 推导为 double
auto z = &x;          // z 推导为 int*

// auto 会去掉引用和顶层 const：
const int ci = 1;
auto a = ci;          // a 是 int（const 被剥掉，可修改）
auto& b = ci;         // 想保留 const 用 auto&，b 是 const int&

// decltype：不求值，直接给出声明的完整类型
decltype(ci) d = 0;           // d 是 const int
decltype(x + 1.0) e;          // e 是 double（表达式求值类型）

// auto 的限制：
// auto f(int a) {}        // 错误：C++20 前不能做函数参数
// auto arr[3] = {1,2,3}; // 错误：不能定义数组，应写 int arr[3]
// auto 必须在声明时初始化
```

**关联场景**：通用——遍历容器、迭代器、复杂模板类型用 auto 简化；面试答"auto 推导引用/const 的规则"是加分点。

---

### 11. 智能指针

**一句话要点**：unique_ptr 独占所有权不可拷贝、shared_ptr 引用计数共享所有权、weak_ptr 不增加计数只观察；shared_ptr 互相引用会形成环导致计数永不为零、内存泄漏，把环中一边改成 weak_ptr 即可打破。

**面试怎么问**："三种智能指针的区别和使用场景？""shared_ptr 循环引用怎么解决？""unique_ptr 为什么不能拷贝？"

**用例 / 示例**：

```cpp
#include <memory>
#include <iostream>
using namespace std;

// unique_ptr：独占，只能移动不能拷贝
std::unique_ptr<int> up(new int(5));
// std::unique_ptr<int> up2 = up;        // 错误：拷贝被删除
std::unique_ptr<int> up3 = std::move(up); // 移动转移所有权，up 变空

// shared_ptr：共享，引用计数
std::shared_ptr<int> sp1(new int(1));
std::shared_ptr<int> sp2 = sp1;          // 计数 2，最后一个析构时才释放

// weak_ptr：不增加计数，需 lock() 提升为 shared_ptr 使用
std::weak_ptr<int> wp = sp1;
if (auto sp = wp.lock()) { /* 对象还活着，安全使用 */ }

// —— 循环引用问题 ——
struct Node {
    std::shared_ptr<Node> next;   // 互相持有 → 泄漏
    ~Node() { cout << "dtor" << endl; }
};
auto a = std::make_shared<Node>();
auto b = std::make_shared<Node>();
a->next = b;
b->next = a;    // 计数都是 2，函数结束无人释放，析构不打印，内存泄漏

// 解法：环中一边改用 weak_ptr，不增加计数
struct Node2 {
    std::weak_ptr<Node2> next;    // 打破环，对象正常析构
};
```

**关联场景**：车联网中间件——连接会话、订阅句柄、任务队列对象用 shared_ptr 管理生命周期，回调捕获用 weak_ptr 防悬垂；裸 new/delete 在 C++ 项目中应绝迹。

---

### 12. C++14 / C++17 新特性

**一句话要点**：C++14 补了泛型 lambda 和函数返回值推导；C++17 实用特性：if constexpr 编译期分支、结构化绑定、std::optional、std::string_view 零拷贝字符串视图、std::filesystem 文件系统。

**面试怎么问**："C++17 你用过哪些特性？""string_view 和 string 有什么区别？""optional 解决什么问题？"

**用例 / 示例**：

```cpp
// ===== C++14 =====
auto f = [](auto x) { return x * 2; };   // 泛型 lambda：参数类型自动推导
auto add(int a, int b) { return a + b; } // 函数返回值类型推导

// ===== C++17 =====
std::optional<int> parse(const std::string& s);   // 可能无值：解析失败返回 nullopt
if (auto v = parse("123"); v) { /* v 有值才进入 */ }

auto [name, age] = person;               // 结构化绑定：解包 pair/结构体成员

std::string_view sv = "hello";           // 字符串视图：只读、零拷贝，性能好
// 注意：string_view 不持有数据，指向的字符串必须比它活得久

if constexpr (sizeof(void*) == 8) {      // 编译期分支，不满足的分支不实例化
    /* 64 位逻辑 */
} else {
    /* 32 位逻辑 */
}

namespace fs = std::filesystem;          // 文件系统库
for (auto& e : fs::directory_iterator("/tmp")) { /* 遍历目录 */ }
```

**关联场景**：车联网中间件——解析上报报文用 string_view 避免拷贝、配置解析失败用 optional 表达、日志/路径处理用 filesystem；这些是"项目里用了什么新特性"的现成答案。

---

### 13. 设计模式：工厂模式与单例模式

**一句话要点**：工厂模式把"创建对象"从使用处抽离——简单工厂按参数分支创建、工厂方法把创建延迟到子类、抽象工厂创建一族相关产品；单例保证全局唯一实例，现代 C++ 用函数内静态局部变量（Meyers' Singleton）天然线程安全，老式 DCLP 有指令重排隐患。

**面试怎么问**："三种工厂模式的区别和适用场景？""手写一个线程安全的单例？""懒汉式怎么保证线程安全？"

**用例 / 示例**：

```cpp
// —— 简单工厂：一个静态函数按类型创建 ——
class Product { public: virtual ~Product() {} };
class ProductA : public Product {};
class ProductB : public Product {};

class Factory {
public:
    static Product* create(int type) {   // 按参数 if/switch 分支创建
        if (type == 1) return new ProductA();
        return new ProductB();
    }
};

// —— 工厂方法：创建逻辑放到子类（虚函数），扩展时新增子类不改旧代码 ——
class FactoryBase {
public:
    virtual Product* create() = 0;       // 纯虚工厂方法
};
class FactoryA : public FactoryBase {
public:
    Product* create() override { return new ProductA(); }
};

// —— 单例（推荐写法：C++11 起局部静态变量初始化线程安全）——
class Singleton {
public:
    static Singleton& get() {
        static Singleton instance;       // 首次调用时创建，且线程安全
        return instance;
    }
    Singleton(const Singleton&) = delete;          // 禁止拷贝
    Singleton& operator=(const Singleton&) = delete;
private:
    Singleton() {}                       // 私有构造，外部不能 new
};

// —— 懒汉式（老写法）：双重检查加锁 DCLP ——
// if (g == nullptr) { lock; if (g == nullptr) g = new Singleton(); }
// 注意：老式 DCLP 存在指令重排问题（先赋地址后调构造），
// C++11 下需用 std::atomic 配合内存序；工程上直接推荐上面的局部静态写法。
```

**关联场景**：车联网中间件——单例常用于配置中心、日志模块、连接池；工厂用于按报文类型/设备型号创建不同协议处理器。

---

### 14. C 语言如何实现继承与多态

**一句话要点**：结构体嵌套模拟继承（把基类放第一个成员，指针强转即可用基类视角访问）；函数指针表模拟虚表（结构体成员放函数指针，构造时指向自己的实现），基类指针调用即动态分发——这是 Linux 内核 file_operations、驱动模型的通用手法。

**面试怎么问**："C 语言能实现继承和多态吗？怎么实现？""内核里 file_operations 是什么设计？"

**用例 / 示例**：

```c
#include <stdio.h>

/* 模拟基类：数据 + 函数指针表（相当于 vtable） */
typedef struct {
    int id;
    void (*speak)(void* self);   /* 虚函数：函数指针成员 */
} Animal;

/* 模拟继承：基类嵌套在派生类第一个成员 */
typedef struct {
    Animal base;                 /* 首成员是基类 → 继承 */
    int legs;
} Dog;

/* 派生类的"重写"实现 */
static void dog_speak(void* self) {
    (void)self;
    printf("wang!\n");
}

/* 派生类"构造"：把函数指针指向自己的实现（相当于填虚表） */
void dog_init(Dog* d, int legs) {
    d->base.id = 100;
    d->base.speak = dog_speak;   /* 虚表槽位指向 Dog 版本 */
    d->legs = legs;
}

int main(void) {
    Dog d;
    dog_init(&d, 4);

    /* 多态：基类指针指向派生类，调用的是派生类实现 */
    Animal* a = (Animal*)&d;     /* 首成员布局相同，强转即用 */
    a->speak(a);                 /* 输出 wang!：动态分发到 dog_speak */
    return 0;
}
```

**关联场景**：车载嵌入式——Linux 驱动（file_operations 函数指针表）、协议栈、RTOS 组件常用此模式；C++ 项目里也常问"C 怎么模拟多态"考察对虚表本质的理解。

---

### 15. 用两个队列实现栈

**一句话要点**：一个队列存数据，另一个做中转；push 直接入队，pop/top 时把主队列除队尾外全部搬到中转队列，队尾即栈顶，取完再交换两个队列。栈后进先出（LIFO）、队列先进先出（FIFO），必须靠中转反转顺序。

**面试怎么问**："用两个队列实现一个栈？""push 和 pop 的时间复杂度是多少？"

**用例 / 示例**：

```cpp
#include <queue>
#include <algorithm>
using namespace std;

class MyStack {
public:
    // push：直接入主队列，O(1)
    void push(int x) {
        q1.push(x);
    }

    // pop：把 q1 前 n-1 个搬到 q2，队尾即栈顶，弹出后交换
    int pop() {
        while (q1.size() > 1) {
            q2.push(q1.front());
            q1.pop();
        }
        int top = q1.front();
        q1.pop();
        swap(q1, q2);        // 交换后 q2 为空，下次仍从 q1 操作
        return top;
    }

    // top：同 pop，但不弹出，栈顶重新入 q2
    int top() {
        while (q1.size() > 1) {
            q2.push(q1.front());
            q1.pop();
        }
        int t = q1.front();
        q2.push(t);          // 栈顶再放回队列
        q1.pop();
        swap(q1, q2);
        return t;
    }

    bool empty() const {
        return q1.empty() && q2.empty();
    }

private:
    queue<int> q1;    // 主队列
    queue<int> q2;    // 中转队列
};

// 使用示例：
// MyStack s;
// s.push(1); s.push(2); s.push(3);
// s.pop();   // 3（后进先出）
// s.top();   // 2
```

**关联场景**：通用——经典手撕题，考察 STL 容器熟练度和"用现有结构实现抽象"的能力；同理题还有"两个栈实现队列""最小栈"。

---

### 16. 右值引用与移动语义

**一句话要点**：右值引用 `T&&` 绑定临时对象（右值）；移动构造把源对象的资源"偷"过来（指针搬运 + 源置空），O(1) 完成，避免深拷贝；std::move 本身不做任何事，只是把左值转成右值引用以触发移动语义。拷贝是复制内容，移动是转移所有权。

**面试怎么问**："移动语义为什么快？""std::move 到底做了什么？""移动构造和拷贝构造的区别？"

**用例 / 示例**：

```cpp
#include <cstring>

class Buffer {
public:
    Buffer(int n) : size(n), data(new char[n]) {}

    // 拷贝构造：深拷贝，O(n)，慢
    Buffer(const Buffer& o) : size(o.size), data(new char[o.size]) {
        memcpy(data, o.data, size);
    }

    // 移动构造：偷资源，O(1)，快；把源对象置空防双重释放
    Buffer(Buffer&& o) noexcept : size(o.size), data(o.data) {
        o.data = nullptr;    // 源不再持有资源，析构时 delete nullptr 安全
        o.size = 0;
    }

    ~Buffer() { delete[] data; }

private:
    int size;
    char* data;
};

Buffer make() { return Buffer(1024); }   // 临时对象（右值）

Buffer a(1024);
Buffer b(a);               // 拷贝：重新分配并复制 1024 字节
Buffer c(std::move(a));    // 移动：只搬指针，a 变空，不拷贝数据

// std::move 的本质：static_cast<T&&>(x)，只是类型转换，本身不移动任何东西
// 移动语义让"返回大对象""容器扩容""push_back(临时对象)"
// 从深拷贝变为指针搬运，性能提升明显
```

**关联场景**：通用——含堆内存/句柄的类写移动构造是加分项；面试常问"为什么 vector 扩容用移动而不用拷贝"。

---

### 17. 手写 String 类

**一句话要点**：经典笔试题，考察三法则（拷贝构造/赋值运算符/析构）与深拷贝：含 new 出来的成员就必须自己管理，防自赋值、防双重释放；精简实现可编译，面试当场讲清每行。

**面试怎么问**："手写一个 String 类？""为什么赋值运算符要先 delete 再 new？""不写拷贝构造会怎样？"

**用例 / 示例**：

```cpp
#include <cstring>
using namespace std;

class String {
public:
    // 默认构造：空串
    String() : m_data(nullptr), m_len(0) {}

    // 带 C 字符串的构造
    String(const char* s) : m_data(nullptr), m_len(0) {
        if (s) {
            m_len = (int)strlen(s);
            m_data = new char[m_len + 1];
            strcpy(m_data, s);
        }
    }

    // 拷贝构造：深拷贝
    String(const String& other) : m_data(nullptr), m_len(other.m_len) {
        if (other.m_data) {
            m_data = new char[m_len + 1];
            strcpy(m_data, other.m_data);
        }
    }

    // 赋值运算符：先释放旧资源，再深拷贝；防自赋值
    String& operator=(const String& other) {
        if (this != &other) {              // 自赋值检查：a = a
            delete[] m_data;               // 释放旧内存
            m_len = other.m_len;
            m_data = nullptr;
            if (other.m_data) {
                m_data = new char[m_len + 1];
                strcpy(m_data, other.m_data);
            }
        }
        return *this;                      // 返回引用支持链式 a = b = c
    }

    // 析构
    ~String() { delete[] m_data; }

    const char* c_str() const { return m_data ? m_data : ""; }
    int size() const { return m_len; }

private:
    char* m_data;    // 堆上的字符串
    int m_len;       // 长度
};

// 使用：String s1("hello"); String s2 = s1; String s3; s3 = s2;
// 加分项：可再补 operator+ / operator[] / operator<< 和移动构造
```

**关联场景**：通用——笔试手写题之王；答案模板"三法则 + 深拷贝 + 自赋值检查"可套用到任意资源类（协议包、图像缓冲、串口帧）。

---

### 18. struct 和 class 的区别

**一句话要点**：C++ 中 struct 与 class 的唯一语言层面区别是默认访问权限（struct 默认 public，class 默认 private）和默认继承方式（struct 默认 public 继承，class 默认 private 继承）；struct 同样可以有构造函数、成员函数、继承与多态，不存在"struct 不能有函数"的说法。

**面试怎么问**："struct 和 class 有什么区别？""struct 里能写构造函数和虚函数吗？""什么时候用 struct 什么时候用 class？"

**用例 / 示例**：

```cpp
// 默认访问权限：struct 默认 public，class 默认 private
struct Point {
    int x;                 // 默认 public，外部可直接访问
    int y;
};

class Circle {
    double r;              // 默认 private，外部不可直接访问
public:
    Circle(double radius) : r(radius) {}   // 构造函数
};

// 默认继承方式：struct 默认 public 继承，class 默认 private 继承
struct BaseS { int a; };
class  BaseC { int b; };

struct DerS : BaseS { };    // 等价于 struct DerS : public BaseS
class  DerC : BaseC { };    // 等价于 class DerC : private BaseC

// 纠正误解：struct 一样可以有构造函数、成员函数、继承、多态
struct Shape {
    Shape() {}                          // 构造函数没问题
    virtual void draw() {}              // 虚函数也没问题
};
struct Square : Shape {                 // 继承也没问题
    void draw() override {}
};

// 使用习惯：简单数据聚合（POD）用 struct；含私有状态、
// 封装与行为逻辑的复杂对象用 class，且显式写 public/private
```

**关联场景**：通用——C 语言里 struct 只是数据容器，C++ 里两者几乎等价，这个"语言差异"题考察对 C++ 与 C 差异的理解；嵌入式 C 转 C++ 面试必问。

---

### 19. char 和 int 之间的转换

**一句话要点**：char 本质是数值类型，赋值给 int 得到该字符的 ASCII 码；int 转 char 用 static_cast 截取低位一个字节；若 int 值超出 char 范围（-128~127）会溢出截断，得到错误结果。

**面试怎么问**："'A' 赋值给 int 是多少？""int 怎么转成 char？""int 值超过 127 转 char 会怎样？"

**用例 / 示例**：

```cpp
char c = 'A';
int i = c;                // i = 65：char 是数值类型，得到 ASCII 码

// int 转 char：static_cast 截取低位一个字节
int code = 66;
char d = static_cast<char>(code);   // d = 'B'

// 超出 char 范围会溢出截断（取低 8 位，按 char 有符号解释）
int big = 300;            // 300 = 0x012C
char e = static_cast<char>(big);    // 取低 8 位 0x2C = 44 → ','
// 注意：char 在多数平台有符号，超过 127 的结果可能是负数

// 经典应用：ASCII 大小写转换就是 char 参与整数运算
char upper = 'A';
char lower = upper + 32;  // 'a'：'A'(65) + 32 = 97
char back  = lower - 32;  // 'A'
```

**关联场景**：通用——串口/网络字节流收发（协议报文逐字节拼接与解析）、ASCII 处理、位操作场景常用；车载 T-Box 解析 AT 指令或 CAN 原始字节流时 char/int 混用很常见。

---

### 20. 野指针 vs 悬挂指针（dangling pointer）

**一句话要点**：野指针是未初始化、值随机的指针；悬挂指针是曾指向有效内存、但该内存已被释放（delete/free 后未置 NULL、返回局部变量地址）的指针；两者解引用都是未定义行为，轻则脏数据重则崩溃；避免靠"声明即初始化、释放后置 NULL、不返回局部变量地址"。

**面试怎么问**："野指针和悬挂指针有什么区别？""free 之后指针要做什么？""为什么不能返回局部变量的地址？"

**用例 / 示例**：

```cpp
// —— 野指针：未初始化就使用 ——
int* p;                    // 未初始化，值随机（野指针）
// *p = 10;                // 错误：向随机地址写，未定义行为
int* q = nullptr;          // 正确做法：声明即初始化

// —— 悬挂指针 ①：delete/free 后未置 NULL ——
int* r = new int(5);
delete r;                  // 内存已释放，r 变为悬挂指针
// *r = 10;                // 错误：访问已释放内存
r = nullptr;               // 正确做法：释放后立即置 NULL

// —— 悬挂指针 ②：返回局部变量的地址 ——
int* bad() {
    int local = 10;
    return &local;         // 错误：函数返回后局部变量销毁，地址悬空
}
// 正确做法：返回堆分配（调用方负责释放）、静态变量或通过传出参数带回

// 记忆：野指针 = 从没指过有效内存；悬挂指针 = 指向的内存已经死了
// 两者解引用都是未定义行为，工程上靠初始化 / 置 NULL / 生命周期管理规避
```

**关联场景**：通用——C/C++ 内存安全高频题，常与智能指针（知识点 11）联动：C++ 中用 unique_ptr/shared_ptr 管理生命周期可以从根上消灭悬挂指针。

---

### 21. NULL 和 nullptr 的区别

**一句话要点**：NULL 是宏，C++ 中通常展开为整数 0；nullptr 是 C++11 关键字，类型为 std::nullptr_t，只能隐式转成指针类型；函数重载时传 NULL 会匹配 int 版本造成二义性，传 nullptr 精确匹配指针版本。

**面试怎么问**："NULL 和 nullptr 有什么区别？""为什么推荐用 nullptr 而不用 NULL？"

**用例 / 示例**：

```cpp
#include <iostream>
#include <cstddef>
using namespace std;

void f(int)   { cout << "int" << endl; }
void f(char*) { cout << "char*" << endl; }

f(NULL);      // 输出 int：NULL 本质是整数 0，重载决议选择 int 版本
f(nullptr);   // 输出 char*：nullptr 类型为 nullptr_t，精确匹配指针版本

// NULL 的定义（C++ 中）：
// #define NULL 0        → NULL 就是整数 0，存在二义性隐患
// nullptr 是关键字，类型 std::nullptr_t：
int* p = nullptr;         // 正确：nullptr 可隐式转为任意指针类型
// int i = nullptr;      // 错误：nullptr 不能转成整数（NULL 可以，这就是坑）
```

**关联场景**：通用——现代 C++ 代码规范一律用 nullptr；老 C 代码习惯 NULL，面试借此考察对 C/C++ 差异和新标准的掌握。

---

### 22. 指针常量和常量指针

**一句话要点**：`const int *p` 是指向常量的指针（指向的内容不可改，指针本身可改指向）；`int *const p` 是常量指针（指针本身不可改指向，指向的内容可改）；`const int *const p` 两者都不可改；判断方法看 const 修饰谁——在 `*` 左边修饰"指向的内容"，在 `*` 右边修饰"指针本身"。

**面试怎么问**："const int* 和 int* const 有什么区别？""怎么快速判断 const 修饰的是谁？"

**用例 / 示例**：

```cpp
int a = 1, b = 2;

// ① 指向常量的指针：const 修饰 *p（指向的内容），内容不可改，指针可改
const int* p = &a;
// *p = 10;        // 错误：*p 是 const，不能通过 p 修改内容
p = &b;            // 正确：指针本身可以改变指向

// ② 常量指针：const 修饰 p（指针本身），指向不可改，内容可改
int* const q = &a;
*q = 10;           // 正确：可以通过 q 修改内容
// q = &b;         // 错误：q 本身是 const，不能改变指向

// ③ 两者都 const：内容和指向都不可改
const int* const r = &a;
// *r = 10;        // 错误
// r = &b;         // 错误

// 判断口诀：const 在 * 左边 → 修饰"指向的内容"；
//          const 在 * 右边 → 修饰"指针本身"
// 从右往左读：int const *p → p 是指向 const int 的指针
```

**关联场景**：通用——嵌入式外设寄存器访问、只读数据区（const 数据段）常配合 const 指针使用；形参 `const T*` 保证不修改实参数据，`T* const` 保证不换目标。

---

### 23. 重载（overload）/ 重写（override）/ 隐藏（hiding）的区别

**一句话要点**：重载 = 同一作用域、同名、不同参数列表，编译期决定；重写 = 派生类重定义基类虚函数（要求 virtual + 签名一致），运行期动态绑定、构成多态；隐藏 = 派生类同名函数把基类同名函数遮蔽（无论参数、无论是否 virtual），无多态，基类指针调基类版本。

**面试怎么问**："重载和重写有什么区别？""什么是名字隐藏？""派生类里写了个同名非虚函数会发生什么？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

// —— 重载 overload：同作用域、同名、不同参数，编译期决定 ——
class Calc {
public:
    int add(int a, int b)               { return a + b; }
    double add(double a, double b)      { return a + b; }   // 参数不同 → 重载
};

// —— 重写 override：派生类重定义虚函数，签名一致 + virtual，动态绑定 ——
class Base {
public:
    virtual void speak() { cout << "base" << endl; }
};
class Derived : public Base {
public:
    void speak() override { cout << "derived" << endl; }    // 重写
};
Base* p = new Derived();
p->speak();    // derived：运行期查虚表，多态生效

// —— 隐藏 hiding：派生类同名函数遮蔽基类同名函数，无多态 ——
class Base2 {
public:
    void show() { cout << "base2" << endl; }
};
class Derived2 : public Base2 {
public:
    void show(int x) { cout << "derived2 " << x << endl; }  // 同名 → 隐藏
};
Derived2 d;
// d.show();       // 错误：基类的 show() 被隐藏，需 d.Base2::show()
d.show(1);          // 正确：调用派生类版本
Base2* p2 = &d;
p2->show();         // base2：非虚函数按指针静态类型调用，无多态

// 速记：
// 重载：同作用域 + 同名 + 不同参数，编译期定；
// 重写：跨作用域 + virtual + 签名一致，运行期定（多态）；
// 隐藏：派生类任何同名函数都藏起基类同名函数，与 virtual/参数无关
```

**关联场景**：通用——三大概念混着问是 C++ 面试必考；注意陷阱：重写必须签名完全一致（加 override 让编译器检查），隐藏则可能因参数不同误写成"假重载"。

---

### 24. 虚拟内存和物理内存的区别

**一句话要点**：物理内存是 RAM 硬件芯片；虚拟内存是操作系统对物理内存（可配合磁盘 swap 扩展）的抽象，大小远超物理内存；CPU 发出的虚拟地址经 MMU + 页表映射到物理地址；虚拟内存带来进程隔离与按需分配，但缺页时要磁盘换入，访问远慢于物理内存。

**面试怎么问**："虚拟内存和物理内存有什么区别？""虚拟地址怎么映射到物理地址？""为什么说每个进程有独立的 4G 地址空间？"

**用例 / 示例**：

```cpp
// 映射过程：CPU 发出虚拟地址 → MMU 查页表 → 得到物理地址
// 页表命中 → 直接访问物理页；未命中（缺页）→ 缺页异常 → 从磁盘 swap
// 换入物理页 → 重新执行，这就是"虚拟内存可以比物理内存大"的原理
int* p = new int;   // 拿到的是虚拟地址；物理页在真正读写时才分配（按需分配）
```

对比表：

| 对比项 | 物理内存 | 虚拟内存 |
| --- | --- | --- |
| 本质 | RAM 硬件芯片（DRAM） | 操作系统对物理内存 + 磁盘（swap）的抽象 |
| 大小 | 受硬件限制（如 4G/8G） | 32 位进程固定 4GB，可大于物理内存 |
| 地址 | 物理地址，总线直接访问 | 虚拟地址，需经 MMU + 页表映射 |
| 隔离性 | 所有进程共享 | 每个进程独立地址空间，互不可见（进程隔离） |
| 分配 | 直接分配使用 | 按需分配，页粒度惰性映射 |
| 访问速度 | 快（ns 级） | 慢：缺页时触发磁盘换入（ms 级） |

```text
32 位进程虚拟地址空间布局（高 → 低）：
内核空间（高 1G）→ 栈 → 堆（向上增长）→ 数据段 → 代码段（低地址）
访问未映射的虚拟地址 → 缺页异常；访问非法/越权地址 → 段错误
```

**关联场景**：通用——C++ 面试常见 OS 送分题，与"内存泄漏""堆和栈的区别"联动考；嵌入式（无 MMU 的 MCU）只有物理内存，有 MMU 的 SoC（运行 Linux 的车机/T-Box 应用处理器）才有虚拟内存，这点可作为嵌入式差异化回答。

---

### 25. 动态链接与静态链接的区别

**一句话要点**：静态链接在编译时把库代码复制进可执行文件（独立部署、体积大、更新库必须重新编译）；动态链接在运行时加载共享库 .so/.dll（节省空间、多进程共享一份、替换 .so 即可升级，但有运行时加载开销和依赖环境）；嵌入式常用 -static 与交叉编译工具链。

**面试怎么问**："静态链接和动态链接的区别？""为什么嵌入式有时强制 -static？""动态库找不到会报什么错？"

**用例 / 示例**：

```bash
# 链接方式由编译选项控制（g++ 示例）：
# 静态链接：把 libfoo.a 的代码复制进可执行文件
g++ main.cpp libfoo.a -o app_static     # 直接给 .a 文件
g++ main.cpp -static -o app_static2     # -static：全部静态链接

# 动态链接：运行时加载共享库 libfoo.so
g++ main.cpp -lfoo -o app_dynamic       # -lfoo = 链接 libfoo.so

# 嵌入式交叉编译：用交叉工具链代替 g++
arm-linux-gnueabihf-g++ main.cpp -lfoo -o app

# 动态库运行期查找：Linux 靠 LD_LIBRARY_PATH / rpath 指定 .so 位置
# 找不到则报：error while loading shared libraries: libfoo.so: cannot open
```

对比表：

| 对比项 | 静态链接 | 动态链接 |
| --- | --- | --- |
| 链接时机 | 编译时 | 运行时（程序启动/首次调用时加载） |
| 可执行文件 | 体积大（含库代码） | 体积小（只含引用） |
| 部署 | 独立部署，无需带库 | 目标机必须存在对应 .so/.dll |
| 更新库 | 必须重新编译 | 替换 .so 即可，无需重编 |
| 内存占用 | 每进程各一份 | 多进程共享一份，省内存 |
| 启动速度 | 快（无加载步骤） | 慢（要动态加载 + 重定位） |
| 适用场景 | 嵌入式单机、无库环境 | 通用 Linux、桌面/服务器 |

**关联场景**：车载嵌入式——MCU 裸机/RTOS 基本全静态；跑 Linux 的车机/T-Box 常用动态库（libssl、MQTT 库）省内存、方便升级，面试常问"为什么嵌入式有时强制 -static"（目标板没有 .so 运行环境）。

---

### 26. C++ 编译与 C 的区别 + 如何在 C++ 中调用 C 代码

**一句话要点**：C++ 因支持重载会对函数做名称修饰（name mangling，函数名带上参数类型），C 不修饰；`extern "C"` 告诉 C++ 编译器按 C 的名称规则链接；标准写法是在头文件里用 `#ifdef __cplusplus` 包住 `extern "C" { }`，这样同一份头文件 C 和 C++ 都能用。

**面试怎么问**："C++ 调用 C 函数为什么要 extern 'C'？""什么是名称修饰？""undefined reference 可能是什么原因？"

**用例 / 示例**：

```cpp
// C 库源码（c_lib.c）：
// int add(int a, int b) { return a + b; }

// 供 C++ 调用的头文件写法（c_lib.h）：
#ifdef __cplusplus              // 只有 C++ 编译器才定义 __cplusplus
extern "C" {                    // 告诉 C++ 编译器：内部声明按 C 规则链接
#endif

int add(int a, int b);          // C 函数声明

#ifdef __cplusplus
}
#endif

// C++ 源文件：
#include "c_lib.h"
int main() {
    return add(1, 2);           // 链接时找 C 风格符号名 add，而非修饰后的名字
}

// 原理：C++ 重载需要区分同名不同参的函数，编译器做名称修饰：
// add(int,int) → _Z3addii（GCC/Itanium ABI 的修饰结果）
// C 不修饰，符号就叫 add；
// 不包 extern "C" 时链接报 undefined reference to 'add(int,int)'，
// 因为 C++ 在找 _Z3addii，而 C 库只导出了 add
```

**关联场景**：通用——嵌入式里 C 库（LwIP、mbedTLS、libcurl、sqlite）被 C++ 上层调用是常态，头文件必须包 extern "C"；面试常从"undefined reference"报错切入考察。

---

### 27. 为什么少用宏？C++ 的替代方案

**一句话要点**：宏的缺点——无类型检查、参数副作用会被多次求值、无作用域可读性差、调试看不到符号；C++ 用 const/constexpr 替代常量宏、inline 函数替代函数宏、template 做泛型、enum class 替代枚举宏。

**面试怎么问**："宏有什么缺点？""为什么不用 #define 定义常量？""怎么替代函数宏？"

**用例 / 示例**：

```cpp
// 宏的问题 ①：无类型检查
#define SQUARE(x) ((x) * (x))
SQUARE(3.14);        // double 也通过，宏不在乎类型

// 宏的问题 ②：参数副作用被多次求值
#define MAX(a, b) ((a) > (b) ? (a) : (b))
int i = 1, j = 2;
int m = MAX(i++, j++);   // i++ 被求值两次！i 变成 3，结果不可预期

// 宏的问题 ③：无作用域、无类型，调试器里看不到符号，报错位置难定位

// —— C++ 替代方案 ——
// ① const / constexpr 替代常量宏
constexpr double PI = 3.1415926;      // 替代 #define PI 3.14159

// ② inline 函数替代函数宏（有类型检查、参数只求值一次）
inline int square(int x) { return x * x; }

// ③ 模板替代泛型宏
template <typename T> T square_t(T x) { return x * x; }

// ④ enum class 替代枚举宏
enum class Color { Red, Green };      // 替代 #define RED 0 / #define GREEN 1
```

**关联场景**：通用——Modern Effective C++ 高频观点（"尽量以 const、enum、inline 替换 #define"）；嵌入式老 C 代码宏多，面试常问"接手 C 代码怎么用 C++ 重构宏"。

---

### 28. 内联函数 inline

**一句话要点**：inline 请求编译器在调用点直接把函数体展开，省去压栈、跳转、返回的调用开销；适合函数体小且调用频繁的场景；注意：函数体大或调用少会导致代码膨胀，定义必须放头文件保证各编译单元一致，虚函数依赖动态绑定一般无法内联，inline 只是建议编译器可忽略。

**面试怎么问**："inline 的作用和适用场景？""inline 和宏有什么区别？""虚函数能内联吗？"

**用例 / 示例**：

```cpp
// 头文件 math_utils.h：inline 定义必须放头文件（所有编译单元可见同一份）
inline int max2(int a, int b) {
    return a > b ? a : b;    // 函数体小：适合内联
}

// 调用点：编译时直接展开成 a > b ? a : b，
// 省去压栈、跳转、返回的调用开销
int x = max2(3, 5);

// 注意点：
// ① 函数体大或调用点少 → 内联导致代码膨胀（空间换时间要权衡）
// ② inline 只是"建议"，编译器可忽略：大函数、递归函数通常不内联
// ③ 虚函数靠虚表动态绑定，调用目标运行期才确定，一般无法内联：
class Base {
public:
    virtual int f() { return 1; }   // 虚函数 + 基类指针调用 → 不内联
};
// ④ 声明放 .cpp 的普通函数加 inline 无意义，定义必须放头文件
// ⑤ 与宏对比：inline 有类型检查、参数只求值一次（见知识点 27）
```

**关联场景**：通用——嵌入式性能敏感路径（中断回调、高频计算、寄存器读写封装）内联小函数常见；C 里可用 static inline 达到类似效果。

---

### 29. C++ 从代码到可执行文件的过程

**一句话要点**：四步——预处理（展开宏/条件编译/#include，生成 .i）→ 编译（语法分析，生成汇编 .s）→ 汇编（生成目标文件 .o）→ 链接（符号解析、重定位、链接库，生成可执行文件）；语法问题在编译期报、符号找不到在链接期报，据此区分编译错与链接错。

**面试怎么问**："从源码到可执行文件经历了哪些步骤？""编译错和链接错怎么区分？""undefined reference 是哪个阶段的错误？"

**用例 / 示例**：

```bash
# gcc/g++ 分步编译（以 C++ 为例）：
g++ -E main.cpp -o main.i     # ① 预处理：展开宏、头文件（.h 全部展开进来），生成 .i
g++ -S main.i -o main.s       # ② 编译：词法/语法分析，生成汇编 .s
g++ -c main.s -o main.o       # ③ 汇编：生成目标文件 .o（机器码，尚未链接）
g++ main.o -o app             # ④ 链接：符号解析 + 重定位 + 链接库 → 可执行文件
```

```cpp
// 各阶段产物与常见错误对应：
// 预处理 .i：宏展开、条件编译、#include 替换；宏没定义/头文件找不到在此阶段报
// 编译   .s：语法错误在此报——少分号、类型不匹配、未声明的标识符，报在具体行号
// 汇编   .o：几乎不报错（除内联汇编写法问题）
// 链接   app：undefined reference（未定义符号）——声明了没实现、
//             漏链接库（缺 -lfoo）、extern "C" 不一致、多文件未编齐

// 编译错 vs 链接错的经典区分：
// 编译错：编译器发现语法/类型问题，报"xxx.cpp:行号: error"
// 链接错：每个 .o 都编好了，但符号找不到，报"undefined reference to `xxx'"
```

**关联场景**：通用——必考基础题，面试常问"编译错和链接错怎么区分"；嵌入式交叉编译四步全由工具链完成，排查链接错误时看产物与 -l 选项。

---

### 30. 继承方式与虚继承

**一句话要点**：public/protected/private 继承逐级收紧基类成员的可见性（取"基类权限 ∩ 继承方式"更严格者）；多重继承的菱形问题——Derived1/Derived2 都继承 Base、Derived3 多继承两者，Base 子对象会存在两份导致访问歧义；virtual 继承只保留一份 Base 子对象，代价是对象多一个虚基类指针。

**面试怎么问**："三种继承方式对成员权限有什么影响？""什么是菱形继承问题？怎么解决？""虚继承有什么代价？"

**用例 / 示例**：

```cpp
class Base {
public:    int pub;
protected: int prot;
private:   int priv;    // private 成员任何派生类都不可直接访问
};

// 继承方式对基类成员可见性的影响（取更严格者）：
// public    继承：pub → public，prot → protected，priv 不可直接访问
// protected 继承：pub/prot → protected，priv 不可直接访问
// private   继承：pub/prot → private，priv 不可直接访问

// —— 菱形继承问题 ——
class Base { public: int data; };         // 祖先

class Der1 : public Base {};              // 两个中间层都继承 Base
class Der2 : public Base {};

class Der3 : public Der1, public Der2 {}; // 多继承 → 含两份 Base 子对象

Der3 d;
// d.data = 1;        // 错误：data 不明确（Base 存在两份）
// d.Der1::data = 1;  // 强制指定其中一份，但两份独立、浪费内存且易错

// —— virtual 继承解决：只保留一份 Base 子对象 ——
class Der1 : virtual public Base {};
class Der2 : virtual public Base {};
class Der3 : public Der1, public Der2 {};

Der3 d2;
d2.data = 1;           // 正确：只有一份 Base，访问无歧义
// 代价：对象里多一个虚基类指针（vptr 指向虚基类表），
//      访问虚基类成员要多一次间接寻址，且构造顺序更复杂
```

**关联场景**：通用——C++ 对象模型经典陷阱题；工程上多继承用得少（常用组合替代），但讲清菱形问题说明对虚表/对象布局理解到位；协议栈、中间件接口设计偶见。

---

### 31. 如何调用被隐藏的基类同名函数与成员变量

**一句话要点**：派生类定义同名函数或成员变量会"隐藏"基类版本（与 virtual、参数列表无关）；用作用域解析运算符 `Base::func()` 和 `Base::x` 显式调用/访问；隐藏与重写（override）不同——隐藏无多态，基类指针调用仍走基类版本。

**面试怎么问**："派生类和基类有同名函数，怎么调基类的？""隐藏和重写有什么区别？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    void show() { cout << "Base::show" << endl; }
    int value = 10;
};

class Derived : public Base {
public:
    void show(int x) { cout << "Derived::show " << x << endl; }  // 同名 → 隐藏基类 show()
    int value = 20;      // 同名成员变量 → 隐藏基类 value
};

Derived d;
// d.show();          // 错误：基类 show() 被隐藏，参数对不上（名字查找在派生类就停了）
d.show(1);            // 正确：调用派生类版本
d.Base::show();       // 显式调用被隐藏的基类版本（作用域解析运算符 ::）

// 成员变量同理：
d.value;              // 20：派生类自己的 value
d.Base::value;        // 10：显式访问被隐藏的基类成员

// 隐藏 vs 重写（override）的区别：
// 隐藏：同名即藏，与 virtual/参数无关，无多态；
//       Base* p = &d; p->show(); 仍调 Base::show（按指针静态类型）
// 重写：必须 virtual + 签名一致，运行期动态绑定，构成多态（见知识点 23）
// 工程技巧：派生类里写 using Base::show; 可把基类同名重载"引入"派生类作用域
```

**关联场景**：通用——考察名字查找（name lookup）规则；面试变形题"派生类有同名函数/变量，怎么访问基类的？"答案就是作用域解析运算符 ::。

---

### 32. 拷贝构造函数

**一句话要点**：拷贝构造函数触发时机——用一个对象初始化另一个对象、函数按值传参、函数返回对象（RVO 优化可能省略）；需要自定义的场景——类含指针成员要深拷贝（三法则）、禁止拷贝用 `=delete`、默认逐成员拷贝效率低；只要所有成员可拷贝，编译器就会自动生成默认版本。

**面试怎么问**："拷贝构造什么时候触发？""什么时候需要自己写拷贝构造？""拷贝构造和赋值运算符的区别？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

class Widget {
public:
    Widget() {}                            // 默认构造
    Widget(const Widget& other) {          // 拷贝构造：用同类对象初始化
        cout << "copy ctor" << endl;
    }
    Widget& operator=(const Widget&) {     // 赋值运算符：已存在的对象被赋值
        cout << "operator=" << endl;
        return *this;
    }
};

Widget a;
Widget b(a);        // ① 拷贝构造：用一个对象初始化另一个对象
Widget c = a;       // ② 拷贝构造（不是赋值！c 还没构造完成）
Widget d;
d = a;              // ③ 赋值运算符：d 已存在，走 operator=

void f(Widget w) { }                       // ④ 按值传参 → 拷贝构造
Widget g() { Widget t; return t; }         // ⑤ 返回对象 → 拷贝构造（RVO 常省略）

// 何时需要自定义拷贝构造：
// ① 类含 new 出来的指针成员 → 必须深拷贝（见知识点 6/17 三法则）
// ② 禁止拷贝的类（单例、锁、串口句柄）→ 声明为 delete：
class MutexGuard {
public:
    MutexGuard(const MutexGuard&) = delete;            // 禁止拷贝
    MutexGuard& operator=(const MutexGuard&) = delete;
};
// ③ 默认拷贝是逐成员浅拷贝，成员含指针/句柄时必然要自己写

// 何时编译器自动生成：所有成员都可拷贝（内置类型、可拷贝的类类型）时，
// 不写也有默认版本；但只要自定义了析构/拷贝/赋值其中之一，应补齐三件套
// 注意：声明了移动构造/移动赋值会"删除"默认拷贝构造（C++11 规则）
```

**关联场景**：通用——高频必考题，常与深拷贝、移动语义（知识点 6/16）联动；嵌入式线程锁、串口/网络句柄类用 =delete 防拷贝是标准做法。

---

### 33. 静态绑定 vs 动态绑定

**一句话要点**：静态类型是声明时的类型（编译期确定），动态类型是指针/引用实际指向对象的类型（运行期确定）；静态绑定在编译期完成（非虚函数、重载决议），动态绑定在运行期完成（虚函数，经 vptr 查 vtable）；同一指针分别指向基类/派生类对象，非虚函数看静态类型、虚函数看动态类型。

**面试怎么问**："静态绑定和动态绑定的区别？""基类指针指向派生类对象，调用非虚函数走哪个版本？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    void display() { cout << "Base::display" << endl; }    // 非虚 → 静态绑定
    virtual void show() { cout << "Base::show" << endl; }  // 虚函数 → 动态绑定
};

class Derived : public Base {
public:
    void display() { cout << "Derived::display" << endl; }
    void show() override { cout << "Derived::show" << endl; }
};

Derived d;
Base* p1 = &d;      // 静态类型 Base*，动态类型 Derived
Base& r1 = d;

p1->display();      // Base::display：非虚函数，编译期按静态类型 Base 绑定
p1->show();         // Derived::show：虚函数，运行期查虚表，按动态类型绑定
r1.show();          // Derived::show：引用和指针一样动态绑定

// 概念对照：
// 静态类型 = 声明时的类型（编译期确定，这里都是 Base）
// 动态类型 = 对象真实类型（运行期确定，这里都是 Derived）
// 静态绑定 = 编译期决定调用谁（非虚函数、函数重载决议）
// 动态绑定 = 运行期经 vptr → vtable 决定调用谁（虚函数，见知识点 2）
```

**关联场景**：通用——与知识点 2（vtable）联动必考；面试答"多态的实现原理"时先提动态绑定、再展开虚表与 vptr。

---

### 34. 析构函数能抛出异常吗？——不能（或不应）

**一句话要点**：析构函数不应抛出异常——异常点之后的清理代码不会执行导致资源泄漏；栈展开（stack unwinding）过程中若析构再抛异常，会出现双重异常并调用 std::terminate 直接终止程序；C++11 起析构函数默认 noexcept；解决方法是析构内部 try-catch 消化异常、用 RAII/智能指针管理资源。

**面试怎么问**："析构函数里能抛异常吗？为什么？""栈展开时抛异常会怎样？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

// 错误示范：析构函数抛异常
class Bad {
public:
    ~Bad() {
        // throw runtime_error("...");   // 绝对不要这样做！
    }
};

// 为什么不能抛：
// ① 异常点之后的清理代码不执行 → 已分配的资源泄漏
// ② 栈展开（stack unwinding）期间，若析构再抛异常，两个异常同时存在
//    → 调用 std::terminate，程序直接 abort（崩溃）
// ③ C++11 起析构函数默认 noexcept(true)，抛异常会直接触发 terminate

// 正确做法 ①：析构内部消化异常
class Good {
public:
    ~Good() {
        try {
            Close();           // 可能抛异常的操作
        } catch (...) {
            // 吞掉或记录日志，绝不让异常逃出析构函数
        }
    }
private:
    void Close() { /* 可能抛异常 */ }
};

// 正确做法 ②：用 RAII/智能指针管理资源，析构只做释放，无异常路径
class Good2 {
    std::unique_ptr<FILE, decltype(&fclose)> fp{nullptr, &fclose};
    // fp 析构时自动 fclose，不涉及异常（见知识点 11）
};
```

**关联场景**：通用——C++ 异常安全必考题，常与 RAII 联动；嵌入式项目常用 -fno-exceptions 禁用异常，直接规避此问题，面试可提一句体现工程经验。

---

### 35. mutable 与 volatile 的区别

**一句话要点**：mutable 修饰类成员，允许在 const 成员函数中修改它（典型用途：缓存、计数、调试统计）；volatile 告诉编译器变量可能被外部改变（硬件寄存器、中断、共享内存），禁止优化、每次都从内存重新读取；两者用途完全不同，volatile 也不是多线程同步工具。

**面试怎么问**："mutable 和 volatile 有什么区别？""const 成员函数里想改某个成员怎么办？""volatile 能保证线程安全吗？"

**用例 / 示例**：

```cpp
// —— mutable：让 const 成员函数能修改指定成员 ——
class Cache {
public:
    int get(int key) const {
        if (m_hit == 0) {
            m_cache = compute(key);   // 修改"逻辑上非状态"的成员
            m_hit = 1;
        }
        return m_cache;
    }
private:
    int compute(int) const { return 42; }
    mutable int m_cache = 0;   // mutable：const 成员函数中可修改
    mutable int m_hit = 0;     // 典型用途：缓存、计数、调试统计
};

// —— volatile：禁止编译器优化，每次从内存读 ——
volatile int g_flag = 0;       // 可能被中断服务程序/硬件修改
// while (g_flag == 0) {}      // 编译器不会把 g_flag 缓存进寄存器，
                              // 每次都重新从内存读，才能看到外部修改

// 典型场景：硬件寄存器映射
#define REG_STATUS (*(volatile uint32_t*)0x40000000)   // 读外设状态寄存器

// 对比总结：
// mutable ：编译期概念，放宽 const 检查，与硬件无关
// volatile：运行期语义，防优化，与硬件寄存器/中断标志有关
// 注意：volatile 不是线程同步工具！多线程共享变量的可见性
//       要用 std::atomic / mutex（见知识点 37）
```

**关联场景**：车载嵌入式——volatile 是嵌入式面试必考（外设寄存器、中断共享标志）；mutable 是 C++ 特有考点，常与 const 成员函数联动提问。

---

### 36. 静态成员函数 vs 普通成员函数

**一句话要点**：静态成员函数用"类名::函数()"直接调用、没有 this 指针、不能访问非静态成员；普通成员函数必须通过对象调用、可以访问静态与非静态成员；静态成员变量类内声明、类外定义，所有对象共享一份。

**面试怎么问**："静态成员函数和普通成员函数有什么区别？""为什么静态成员函数不能访问非静态成员？""静态成员变量怎么定义？"

**用例 / 示例**：

```cpp
class Counter {
public:
    static int getCount() { return s_count; }        // 静态成员函数
    int getId() const { return m_id; }               // 普通成员函数

    static void setCount(int n) {
        s_count = n;
        // m_id = n;     // 错误：静态成员函数没有 this，不能访问非静态成员
    }

    void reset() {
        s_count = 0;      // 普通成员函数可以访问静态成员
        m_id = 0;
    }

private:
    int m_id = 0;                     // 非静态成员：每个对象各一份
    static int s_count;               // 静态成员变量：类内声明
};
int Counter::s_count = 0;             // 类外定义（唯一一份，所有对象共享）

// 调用方式：
Counter::getCount();      // 静态成员函数：类名直接调用，无需对象
Counter c;
c.getId();                // 普通成员函数：必须通过对象调用
c.getCount();             // 静态函数也能用对象调用（不推荐）

// 为什么静态成员函数不能访问非静态成员：
// 非静态成员属于"具体某个对象"，要靠 this 指针定位；
// 静态成员函数不属于任何对象、没有 this，自然无法访问
// 存储：非静态成员每个对象一份；静态成员整个程序只有一份（全局存储区）
```

**关联场景**：通用——静态成员函数常用于工厂方法（知识点 13 简单工厂）、工具/单例类；面试常问"static 函数为什么不能访问非静态成员"，答"没有 this"即可。

---

### 37. 原子操作 std::atomic

**一句话要点**：原子操作是不可分割的操作（要么全部完成要么完全不发生）；std::atomic 提供 store/load/fetch_add/++/compare_exchange_strong（CAS）等无锁原子操作，适合计数器、标志位等简单共享变量；与互斥锁相比原子操作轻量无锁，但只保证"单个操作"原子，复合逻辑仍需锁。

**面试怎么问**："什么是原子操作？""std::atomic 和 mutex 怎么选？""两个原子操作合起来一定安全吗？"

**用例 / 示例**：

```cpp
#include <atomic>
#include <thread>
using namespace std;

std::atomic<int> g_count{0};        // 原子计数器
std::atomic<bool> g_running{true};  // 原子标志

// 多线程 ++ 安全：不会丢失更新（普通 int 的 ++ 会被其他线程打断）
void worker() {
    for (int i = 0; i < 10000; ++i) {
        g_count++;                   // 原子自增，等价于 fetch_add(1)
    }
}

// 常用操作：
g_count.store(10);                   // 原子写
int v = g_count.load();              // 原子读
int old = g_count.fetch_add(1);      // 返回旧值并 +1
bool ok = g_count.compare_exchange_strong(old, 100);
// CAS：当前值 == old 则置为 100 并返回 true；
//      否则把 old 更新为当前值并返回 false

// 与互斥锁对比：
// 原子操作：无锁、轻量、性能高；适合计数器、标志位等简单场景
// 互斥锁：  适合保护复杂临界区（多条语句需要整体不可分割时）

// 注意：atomic 保证"单个操作"原子，不保证"一段逻辑"原子：
// if (g_count.load() == 0) { g_count.store(1); }   // 两步之间可被插队
// 这种"先检查再修改"要用 CAS 或 mutex 保证整体性；
// 共享复杂数据结构仍需 mutex + condition_variable（见知识点 9）
```

**关联场景**：车联网中间件——多线程处理连接/上报时的计数、运行标志、简单统计用 atomic 无锁高效；复杂消息队列仍用 mutex + 条件变量。

---

### 38. 静态变量什么时候初始化（正确版）

**一句话要点**：C 中全局/静态变量在程序启动前完成静态初始化（BSS 段清零、Data 段拷贝初值）；C++ 中常量初始化在编译期完成、非常量（动态）初始化在程序启动时 main 之前完成；函数内局部 static 变量在首次执行到声明处才初始化（只一次，C++11 起线程安全）；网上"C++ 全局静态变量推迟到首次使用才初始化"的说法是错的，那是局部 static 的行为被误套到全局上。

**面试怎么问**："全局静态变量什么时候初始化？""局部 static 和全局 static 初始化时机一样吗？""main 之前发生了什么？"

**用例 / 示例**：

```cpp
// ===== 全局 / 命名空间级静态变量 =====
int g_a = 5;                 // 常量初始化：编译期确定初值，写入 Data 段
int g_b;                     // 零初始化：BSS 段，启动时清零
int g_c = getValue();        // 动态初始化：程序启动时（main 之前）调用函数初始化
// 注意：g_c 不是"首次使用才初始化"！它在 main 之前就完成初始化

// ===== 函数内局部 static 变量 =====
int func() {
    static int s = compute();   // 首次执行到这一行时才初始化，且只初始化一次
    return s;
    // 特点：
    // ① 生命周期 = 程序生命周期（静态存储期）
    // ② 初始化时机 = 首次执行到声明处（延迟初始化）
    // ③ C++11 起初始化线程安全（多个线程同时首次进入也只初始化一次）
    // ④ 局部 static 常用于实现单例（Meyers' Singleton，见知识点 13）
}

// ===== 纠正常见错误说法 =====
// 网上流传"C++ 全局静态变量推迟到首次使用才初始化"——这是错的！
// 正确区分：
// 全局/命名空间级静态变量：程序启动时（main 之前）完成初始化（动态初始化阶段）
// 局部 static 变量：首次执行到声明处才初始化（延迟初始化）
// 错误说法就是把"局部 static"的行为误套到了"全局静态变量"上

// 额外注意：跨编译单元的全局动态初始化顺序未定义（静态初始化顺序惨剧 SIOF），
// 工程上避免在全局初始化中依赖其他文件的全局对象，
// 常用"函数内局部 static"（Meyers 单例）替代全局对象
```

**关联场景**：通用——纠正网上错误说法是加分点；嵌入式启动流程（启动汇编/链接脚本完成 BSS 清零、Data 段拷贝）之后、main 之前，C++ 还会执行全局对象的动态初始化（__static_initialization），可与知识点 13 的单例写法联动讲解。

---

### 39. Lambda 表达式

**一句话要点**：lambda 语法 `[捕获](参数) -> 返回类型 { 函数体 }`，本质是匿名函数对象；捕获方式有 `[=]` 值捕获、`[&]` 引用捕获、`[this]` 捕获当前对象、`[x]` 指定捕获；值捕获默认只读、加 mutable 可改拷贝；常用作 STL 算法谓词、std::function 回调、线程函数；注意引用捕获的悬垂风险。

**面试怎么问**："lambda 的捕获方式有哪几种？""值捕获能修改捕获的变量吗？""lambda 作为回调要注意什么？"

**用例 / 示例**：

```cpp
#include <algorithm>
#include <functional>
#include <thread>
#include <vector>
using namespace std;

// 语法：[捕获列表](参数列表) -> 返回类型 { 函数体 }
auto add = [](int a, int b) -> int { return a + b; };   // 完整写法
auto add2 = [](int a, int b) { return a + b; };         // 返回类型可省略（auto 推导）

// —— 捕获方式 ——
int base = 10, step = 2;
auto f1 = [=]() { return base + step; };    // [=] 值捕获：拷贝一份，只读
auto f2 = [&]() { return base + step; };    // [&] 引用捕获：直接用原变量
auto f3 = [base]() { return base; };        // [x] 指定捕获：只捕获 base（值）
auto f4 = [&base]() { return base; };       // 指定引用捕获
// [this]：捕获当前对象的 this，可在 lambda 内访问类成员

// mutable：值捕获默认只读，加 mutable 后可修改（改的是拷贝）
int n = 1;
auto f5 = [n]() mutable { return ++n; };    // 修改拷贝，外部 n 不变
f5();    // 2
// n;     // 仍是 1

// —— 使用场景 ——
vector<int> v{3, 1, 2};
sort(v.begin(), v.end(), [](int a, int b) { return a > b; });  // 降序

std::function<int(int)> cb = [](int x) { return x * 2; };      // 存为回调

thread t([&] { /* 在线程里访问外部变量 */ });                  // 线程函数
t.join();

// —— 注意：引用捕获的悬垂风险 ——
// auto bad = [&] { return base; };   // 若 lambda 被保存到 base 作用域之外
//                                     // 之后再调用 → base 已销毁 → 悬垂引用
// 安全做法：需要长期保存的 lambda 优先用值捕获 [=] 或 [x]
```

**关联场景**：车联网中间件——MQTT 消息回调、定时器回调、线程任务用 lambda 捕获上下文是日常写法；面试常问"lambda 和函数指针/仿函数（functor）的区别"（lambda 是语法糖，本质是匿名仿函数）。

---

### 40. 左值 vs 右值

**一句话要点**：左值是有地址、可取址、可修改的表达式（如变量）；右值是临时值、无地址、不能取地址（常量、字面量、表达式结果、临时对象）；左值引用绑定左值，右值引用 `&&` 绑定右值；区分两者的意义在于引出移动语义——临时对象（右值）的资源可以被"偷走"而非深拷贝。

**面试怎么问**："什么是左值什么是右值？""为什么 &(x+1) 不合法？""右值引用和移动语义有什么关系？"

**用例 / 示例**：

```cpp
int x = 10;      // x 是左值：有地址、可取址、可修改
&x;              // 合法：取左值的地址
// &(x + 1);     // 不合法：x + 1 是右值（临时结果），没有地址

10;              // 字面量是右值
x + 1;           // 表达式结果是右值
getValue();      // 函数返回的临时对象是右值

// 左值引用绑定左值；右值引用 && 绑定右值
int a = 5;
int& r1 = a;          // 合法：左值引用绑左值
// int& r2 = 5;       // 错误：左值引用不能绑右值
int&& r3 = 5;         // 合法：右值引用绑右值（延长临时对象生命周期）
// int&& r4 = a;      // 错误：右值引用不能直接绑左值（除非 std::move）

// 区分意义：右值是"将亡的临时对象"，资源可以被偷走 →
// 引出移动语义（知识点 16）：把临时对象资源搬走而非深拷贝
string s = string("hello");   // 右侧临时 string 是右值 → 触发移动构造
// 判断口诀：能取地址、能长期存在的是左值；临时、无地址的是右值
```

**关联场景**：通用——与知识点 16（移动语义）、知识点 41（完美转发）联动，是现代 C++ 面试三大基础概念；答清"临时对象为何能移动"即掌握要点。

---

### 41. 完美转发

**一句话要点**：模板参数 `T&&` 在 T 为推导类型时是"万能引用/转发引用"（不是右值引用）；引用折叠规则保证实参为左值时 T 推导为 `T&`、为右值时推导为 T；`std::forward<T>(arg)` 按 T 保持实参原本的左/右值类别；与 std::move 的区别：move 无条件转右值，forward 有条件转发。

**面试怎么问**："T&& 一定是右值引用吗？""std::forward 和 std::move 有什么区别？""什么是引用折叠？"

**用例 / 示例**：

```cpp
#include <utility>
using namespace std;

void otherFunction(int& v)  { /* 左值版本 */ }
void otherFunction(int&& v) { /* 右值版本 */ }

// 万能引用（转发引用）：T 是模板推导类型时，T&& 不是右值引用
template <typename T>
void process(T&& arg) {
    // std::forward<T>(arg)：按实参原本的值类别转发
    // 实参是左值 → T = int&，折叠后 arg 是 int&，forward 保持左值
    // 实参是右值 → T = int，arg 是 int&&，forward 转成右值
    otherFunction(std::forward<T>(arg));   // 完美转发：保持左/右值属性
}

int x = 1;
process(x);          // 传左值 → 调用 otherFunction(int&)
process(1);          // 传右值 → 调用 otherFunction(int&&)

// 引用折叠四规则（T 是推导出的类型）：
// T&  &  → T&      T&  && → T&
// T&& &  → T&      T&& && → T&&
// 口诀：只要有一个 & 结果就是 &；全 && 才是 &&

// 与 std::move 的区别：
// std::move(x)          ：无条件把 x 转成右值引用（强制移动）
// std::forward<T>(arg)  ：有条件转发——T 是左值引用则保持左值，否则转右值
// 工程原则：函数模板内转发参数用 forward，不要用 move
```

**关联场景**：通用——现代 C++ 模板库（vector、make_shared 内部）高频机制；面试常问"为什么 emplace_back 需要完美转发"（直接构造、避免拷贝）。

---

### 42. 函数模板与模板特化

**一句话要点**：函数模板 `template<typename T>` 按调用实参推导 T 并隐式实例化生成代码；显式实例化用 `my_max<int>(...)`；模板特化 `template<>` 为特定类型提供定制实现（如 const char* 的比较要按字符串内容而非指针地址）；模板多态是编译期多态，虚函数多态是运行期多态。

**面试怎么问**："函数模板怎么实例化？""什么时候用模板特化？""模板和虚函数实现多态的区别？"

**用例 / 示例**：

```cpp
#include <cstring>
using namespace std;

// 函数模板：编译器按调用实参推导 T 并生成对应代码（隐式实例化）
template <typename T>
T my_max(T a, T b) {
    return a > b ? a : b;
}

int m1 = my_max(3, 5);         // 隐式实例化：T = int
double m2 = my_max(3.5, 2.0);  // 隐式实例化：T = double

// 显式指定类型（显式实例化/调用）：
int m3 = my_max<int>(1, 2);

// 模板特化：为特定类型提供定制实现
template <>
const char* my_max<const char*>(const char* a, const char* b) {
    return strcmp(a, b) > 0 ? a : b;   // 比较字符串内容而非指针地址
}
// 若没有特化：my_max("abc", "abd") 会比较两个指针地址（几乎总是相等/错乱）
const char* s = my_max("abc", "abd");  // 走特化版本，返回 "abd"

// 类模板简述：std::vector<T>、std::stack<T>、std::shared_ptr<T>
// 都是类模板实例化；template <typename T> class Stack { ... }; Stack<int> st;

// 模板 vs 多态（虚函数）的区别：
// 模板（编译期多态）：编译时生成具体类型代码，无运行时开销，但代码膨胀
// 虚函数（运行期多态）：运行时经虚表分发，灵活，但有一次间接寻址开销
// 面试常问："模板和虚函数都能实现多态，区别？"→ 编译期 vs 运行期
```

**关联场景**：通用——STL 使用基础 + 编译期/运行期多态对比必考；嵌入式模板代码膨胀问题（-Os 下模板实例化多）可与知识点 2 联动讲。

---

### 43. 四种 cast 转换

**一句话要点**：static_cast 编译期转换（基本类型、继承体系上下转，不检查，最常用）；dynamic_cast 运行期安全向下转换（要求基类有多态虚函数，失败返回 nullptr/抛 bad_cast）；const_cast 去除 const（修改真 const 对象是未定义行为，慎用）；reinterpret_cast 位级重解释（最危险，仅底层/硬件访问用）；原则：优先 static_cast，避免 reinterpret_cast。

**面试怎么问**："四种 cast 有什么区别？""dynamic_cast 什么条件下能用？""C 风格强转和 C++ cast 哪个好？"

**用例 / 示例**：

```cpp
#include <cstdint>
using namespace std;

// —— static_cast：编译期转换，不做运行期检查 ——
double d = 3.14;
int i = static_cast<int>(d);        // 基本类型转换，截断小数
class Base { public: virtual ~Base() {} };
class Derived : public Base {};
Base* pb = new Derived();
Derived* pd = static_cast<Derived*>(pb);   // 向下转换：编译期通过
// 但如果 pb 实际不是 Derived，static_cast 不检查 → 未定义行为

// —— dynamic_cast：运行期安全向下转换（要求基类有虚函数）——
Derived* pd2 = dynamic_cast<Derived*>(pb); // 运行期检查类型
if (pd2 == nullptr) { /* pb 不是 Derived，安全处理 */ }
// 引用版本转换失败抛 std::bad_cast 异常

// —— const_cast：去除/添加 const（不改变底层存储）——
const int ci = 5;
int* p = const_cast<int*>(&ci);
// *p = 10;     // 危险：ci 本身是 const 对象，修改它是未定义行为
// 正确用途：调用"签名没写 const 但实际不改数据"的遗留 C 接口

// —— reinterpret_cast：位级重解释，最危险 ——
uint32_t addr = 0x40000000;
volatile uint32_t* reg = reinterpret_cast<volatile uint32_t*>(addr);
// 整数地址 → 寄存器指针：外设寄存器访问（嵌入式典型用法）
// 不做任何检查，滥用会破坏类型安全

// 对比表：
// static_cast      编译期，基本类型/继承转换，不检查，最常用
// dynamic_cast     运行期，需多态基类，安全向下转，失败 nullptr/bad_cast
// const_cast       去/加 const，改真 const 对象是 UB，慎用
// reinterpret_cast 位级重解释，最危险，仅底层/硬件场景
// 原则：优先 static_cast，避免 reinterpret_cast，少用 C 风格 (T)x
```

**关联场景**：车载嵌入式——外设寄存器映射用 reinterpret_cast + volatile（见知识点 35）；协议帧多态解析用 dynamic_cast 或 static_cast；面试强调"优先 static_cast、避免 reinterpret_cast"是加分回答。

---

### 44. 虚函数可以是模板函数吗？——不能

**一句话要点**：不能。模板在编译期按调用类型实例化，实例化数量编译完才确定；而虚函数在运行期经 vtable 动态绑定，vtable 大小必须在编译期固定；编译器无法为"实例化数量不确定"的模板函数生成固定大小的虚函数表，因此语法直接禁止。

**面试怎么问**："虚函数能不能是模板函数？为什么？""模板实例化和虚函数绑定分别发生在什么时候？"

**用例 / 示例**：

```cpp
class Base {
public:
    // template <typename T> virtual void f(T);   // 错误！虚函数不能是模板
    // 原因：
    // ① 模板在编译期按调用类型实例化：f<int>、f<double>...
    //    实例化多少个、各自叫什么名字，编译完才知道
    // ② 虚函数靠运行期查 vtable 动态绑定，而 vtable 的大小
    //    和槽位必须在编译期就固定下来
    // ③ 编译器无法预先知道要往 vtable 里放多少个不同实例的地址
    //    → 无法生成固定大小的虚函数表，所以语法直接禁止

    virtual void f() {}        // 虚函数可以，但不能是模板
    template <typename T>
    void g(T t) {}             // 普通成员函数可以是模板（非虚模板成员）
};
```

**关联场景**：通用——考察模板与虚函数机制的本质冲突（编译期实例化 vs 运行期绑定），与知识点 2/42 联动；面试答出"vtable 需要编译期定长"即到位。

---

### 45. 虚函数表与虚函数指针

**一句话要点**：虚函数表 vtable 在编译期创建、每个类只有一份、存放在代码段/只读区；每个对象含一个虚指针 vptr 指向所属类的 vtable，同一类的所有对象 vptr 指向同一张表；派生类继承基类 vtable、重写的虚函数替换对应表项、新虚函数追加在末尾；多继承时对象可有多个 vptr。

**面试怎么问**："vtable 存在哪里？每个类几份？""派生类对象的 vptr 指向什么？""多继承对象有几个 vptr？"

**用例 / 示例**：

```cpp
class Base {
public:
    virtual void f1() {}
    virtual void f2() {}
};
class Derived : public Base {
public:
    void f1() override {}    // 重写：替换 vtable 中对应表项
    virtual void f3() {}     // 新增：追加到 vtable 末尾
};
```

```text
Derived 对象内存布局：
┌──────────────┐        Derived 类的 vtable（每类一份，只读区）：
│ vptr ────────┼───→    ┌────────────────────┐
├──────────────┤        │ [0] Derived::f1    │ ← 重写后替换为派生类版本
│ 基类成员...  │        │ [1] Base::f2       │ ← 未重写仍指向基类版本
└──────────────┘        │ [2] Derived::f3    │ ← 派生类新增，追加在末尾
                        └────────────────────┘

要点：
① vtable 在编译期创建，每个类只有一份，放在代码段/只读区
② 每个对象有一个 vptr（64 位下 8 字节），指向所属类的 vtable
③ 同一类的所有对象，vptr 指向同一张表
④ 派生类 vtable = 继承基类表 + 重写的项被替换 + 新虚函数追加
⑤ 多继承：对象内含多个 vptr，每个含虚函数的基类对应一个
   （多个 vptr 分别指向各基类的 vtable，布局更复杂）
⑥ 虚函数调用开销：一次间接寻址（见知识点 2/33）
```

**关联场景**：通用——与知识点 2（多态实现原理）互补深入；面试常问"vptr 放在对象哪里""sizeof(对象) 为什么比成员之和多 8 字节"。

---

### 46. 操作符重载

**一句话要点**：可重载的操作符：`+ - * / = == != < > << >> [] () ++ -- +=` 等；不能重载的：`.` 成员选择、`::` 作用域、`?:` 三目、`sizeof`、`typeid`、`.*`；注意点——`=` 必须定义为成员函数，前置 `++` 返回引用、后置 `++` 返回值（int 占位参数区分），`<<` 输出流通常定义为友元函数，`[]` 返回引用才能支持赋值。

**面试怎么问**："哪些运算符不能重载？""前置 ++ 和后置 ++ 怎么区分？""为什么 operator<< 要写成友元？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

class Complex {
public:
    Complex(double r = 0, double i = 0) : real(r), imag(i) {}

    // 运算符 + 重载：成员函数（左操作数是 this）
    Complex operator+(const Complex& o) const {
        return Complex(real + o.real, imag + o.imag);
    }

    // 前置 ++：返回引用（支持 ++(++c) 连续调用）
    Complex& operator++() {
        ++real; ++imag;
        return *this;
    }
    // 后置 ++：int 占位参数区分，返回值（返回自增前的旧值）
    Complex operator++(int) {
        Complex old = *this;
        ++real; ++imag;
        return old;
    }

    // 赋值 = 必须定义为成员函数
    Complex& operator=(const Complex& o) {
        if (this != &o) { real = o.real; imag = o.imag; }
        return *this;
    }

    // 下标 [] 返回引用才能支持赋值（容器类写法）
    // double& operator[](int idx) { return data[idx]; }

private:
    double real, imag;
    // 友元：让 operator<< 能访问私有成员
    friend ostream& operator<<(ostream& os, const Complex& c);
};

// 输出流 << 定义为友元函数（左操作数 ostream 不是本类对象，不能做成员）
ostream& operator<<(ostream& os, const Complex& c) {
    os << c.real << "+" << c.imag << "i";
    return os;
}

// 用法：
// Complex a(1, 2), b(3, 4);
// Complex c = a + b;    // 调用 operator+
// cout << c << endl;    // 输出 4+6i

// 不能重载的运算符：
// .  成员选择        :: 作用域解析        ?: 三目
// sizeof            typeid               .* 成员指针选择
// 原因：这些运算符依赖语言内置语义，不应也无法改变

// 注意点汇总：
// ① =、[]、()、-> 必须定义为成员函数
// ② <<、>> 通常定义为友元（左操作数非本类，且要访问私有成员）
// ③ 前置 ++/-- 返回引用、后置返回旧值，用 int 占位参数区分
// ④ 重载不能改变运算符优先级、结合性，也不能创造新运算符
```

**关联场景**：通用——STL 容器与自定义类型联动的基础（排序要重载 <、打印要重载 <<）；手写 String 类（知识点 17）常考 operator+ / operator[] / operator<<。

---

### 47. 纯虚函数与抽象类

**一句话要点**：`virtual void func() = 0` 声明纯虚函数（只有声明没有实现）；含纯虚函数的类是抽象类、不能实例化；派生类必须实现全部纯虚函数才能实例化；全部成员都是纯虚函数的类≈接口类；典型应用是协议抽象接口、策略模式、回调抽象。

**面试怎么问**："什么是抽象类？能不能实例化？""派生类不实现纯虚函数会怎样？""接口类和抽象类什么关系？"

**用例 / 示例**：

```cpp
// 抽象类：含纯虚函数，不能创建对象
class Protocol {
public:
    virtual ~Protocol() {}                       // 抽象类要有虚析构（知识点 3）
    virtual void send(const char* data) = 0;     // 纯虚函数：只有声明，无实现
    virtual void recv() = 0;
    void log(const char* msg) { /* 非虚函数：可被派生类继承复用 */ }
};

// Protocol p;   // 错误：抽象类不能实例化

// 派生类必须实现所有纯虚函数才能实例化
class CanProtocol : public Protocol {
public:
    void send(const char* data) override { /* CAN 发送实现 */ }
    void recv() override { /* CAN 接收实现 */ }
};
CanProtocol can;   // 正确：实现了全部纯虚函数

// 若还有未实现的纯虚函数，派生类仍是抽象类：
class TcpProtocol : public Protocol {   // 只实现了一个
public:
    void send(const char* data) override { /* TCP 发送 */ }
    // recv 未实现 → TcpProtocol 仍是抽象类，不能实例化
};

// 全部是纯虚函数的类 ≈ 接口类（纯接口，类似 Java interface）
class ICallback {
public:
    virtual ~ICallback() {}
    virtual void onEvent(int id) = 0;
};

// 应用场景：
// ① 协议抽象：上层只依赖 Protocol 指针，多态分发（见知识点 1/2）
// ② 策略模式：不同编解码/校验策略实现同一接口，运行期切换
// ③ 回调抽象：注册回调对象，事件到达时统一调用 onEvent
```

**关联场景**：车联网中间件——CAN/TCP/MQTT 协议适配层用抽象类定义统一接口；回调机制用接口类；面试常问"抽象类为什么要有虚析构"（见知识点 3）。

---

### 48. 构造函数为什么不能是虚函数？构造/析构中调用虚函数会怎样？

**一句话要点**：构造函数不能是虚函数——构造对象时对象还不存在、vptr 正在初始化，没有完整对象可供查表；构造/析构函数中调用虚函数不会多态：基类构造期间 vptr 指向基类 vtable 走基类版本，析构时派生类部分已销毁同理走当前类版本；工程上应避免在构造/析构中调用虚函数。

**面试怎么问**："构造函数能是虚函数吗？为什么？""构造/析构函数里调用虚函数会怎样？"

**用例 / 示例**：

```cpp
#include <iostream>
using namespace std;

class Base {
public:
    Base() { show(); }        // 构造中调用虚函数
    virtual ~Base() {}
    virtual void show() { cout << "Base::show" << endl; }
};

class Derived : public Base {
public:
    Derived() { show(); }     // 构造中调用虚函数
    void show() override { cout << "Derived::show" << endl; }
};

Derived d;
// 输出顺序：
// Base::show      ← 构造 Base 期间 vptr 还指向 Base 的 vtable → 走 Base 版本
// Derived::show   ← 构造 Derived 时 vptr 已指向 Derived 的 vtable

// 为什么构造函数不能是虚函数：
// ① 虚函数调用需要 vptr 指向已建好的 vtable；而构造对象时对象还不存在、
//    vptr 正在初始化，没有"完整对象"可供查表 → 语法直接禁止
// ② 编译器也无法为构造函数生成虚表项（构造时对象动态类型尚未确定）

// 构造/析构中调用虚函数的关键结论：不会多态！
// 调用的是"当前正在构造/析构的那个类"的版本：
// ① 构造：基类构造期间 vptr 指向基类 vtable → 调基类版本
// ② 析构：派生类析构完成后 vptr 退化指向基类 vtable → 调基类版本
// 工程建议：避免在构造/析构中调用虚函数；
// 需要初始化多态行为时，用"工厂 + 显式初始化方法"模式
```

**关联场景**：通用——对象生命周期经典陷阱题，与知识点 2（vptr/vtable）、3（虚析构）联动；面试常以"new Derived() 的打印顺序"变形考察。

---

### 49. vector vs list 对比

**一句话要点**：vector 是连续动态数组（随机访问 O(1)、尾部操作快、中间插删 O(n) 搬移、内存省）；list 是双向链表（中间插删 O(1) 改指针、无随机访问 O(n) 遍历、每节点有前后指针和分配开销）；选型看"随机访问为主"还是"频繁中间插删为主"。

**面试怎么问**："vector 和 list 有什么区别？""什么时候用 list？""list 的 insert 为什么是 O(1)？"

**用例 / 示例**：

```cpp
#include <vector>
#include <list>
using namespace std;

vector<int> v{1, 2, 3, 4, 5};       // 连续动态数组
list<int>   l{1, 2, 3, 4, 5};       // 双向链表

// 随机访问
int x = v[2];           // O(1)：指针 + 下标直接算地址
// int y = l[2];        // 错误：list 没有 []，只能 ++ 迭代器遍历（O(n)）

// 尾部操作
v.push_back(6);         // O(1) 摊还
l.push_back(6);         // O(1)

// 中间插入/删除
v.insert(v.begin() + 2, 99);          // O(n)：后续元素整体后移
l.insert(next(l.begin(), 2), 99);     // O(1)：只改相邻节点指针
```

对比表：

| 对比项 | vector | list |
| --- | --- | --- |
| 存储 | 连续动态数组 | 双向链表（节点分散在堆上） |
| 随机访问 | O(1) 下标 [] | O(n) 只能遍历 |
| 中间插入/删除 | O(n) 元素搬移 | O(1) 改指针 |
| 首部插入 | O(n) | O(1) |
| 内存占用 | 省（连续一块） | 每节点额外 2 个指针（64 位下 16 字节）+ 每节点一次分配 |
| 迭代器稳定性 | 扩容/中间操作全部失效 | 除被删元素外都有效 |
| 适用场景 | 尾部操作 + 随机访问为主 | 频繁中间插删、元素大而移动成本高 |

**关联场景**：通用——容器选型必考题；嵌入式内存受限场景常问"list 节点开销多大"（对比 vector 连续存储的 cache 友好性）。

---

### 50. vector 底层实现与动态扩容

**一句话要点**：vector 底层用三个迭代器/指针管理连续内存——start（首元素）、finish（当前末尾）、end_of_storage（容量末尾）；容量不足时新分配约 2 倍连续空间、拷贝/移动元素、释放旧空间（迭代器全部失效）；size 是元素个数、capacity 是容量、reserve 只扩容量不扩 size。

**面试怎么问**："vector 扩容原理？为什么 push_back 均摊 O(1)？""size、capacity、reserve 区别？""扩容后迭代器会怎样？"

**用例 / 示例**：

```cpp
#include <vector>
using namespace std;

vector<int> v;               // 底层三个指针（迭代器）：
// start（begin）         → 指向首元素
// finish（end）          → 指向当前末尾（size 位置）
// end_of_storage         → 指向容量末尾（capacity 位置）
// size     = finish - start
// capacity = end_of_storage - start

v.reserve(10);               // reserve：只扩 capacity，不改变 size
v.push_back(1);              // size=1, capacity=10
// v.resize(5)：改变 size（新元素默认构造），capacity 不足时顺带扩容

// 动态扩容原理：
// ① push_back 时 size == capacity → 触发扩容
// ② 新分配一块约 2 倍大小的连续内存（常见 1.5~2 倍策略）
// ③ 把旧元素拷贝/移动（C++11 起用移动构造，见知识点 16）到新空间
// ④ 释放旧空间，更新三个指针
// 摊还分析：每次扩容翻倍，平均到每次 push_back 是 O(1)

// size / capacity / reserve 区别：
// size()     = 已存放的元素个数（finish - start）
// capacity() = 已分配内存能容纳的元素个数（end_of_storage - start）
// reserve(n) = 预分配至少 n 个容量（避免多次扩容搬移）
// 扩容会让所有迭代器、指针、引用失效（元素整体搬家了）
// 避免频繁扩容：大致知道数量时先 reserve（如解析完报文再存 vector）
```

**关联场景**：通用——STL 高频考点；车联网中间件批量上报数据用 vector 时先 reserve 是性能优化点，可结合"扩容搬移成本"讲。

---

### 51. vector vs deque

**一句话要点**：deque（双端队列）用"中控器（指针数组）+ 分段连续缓冲区"实现，首尾插入删除都是 O(1)、随机访问 O(1) 但略慢于 vector；向中间插入不使已有迭代器失效（rehash 时首尾迭代器失效）；适合"两端都要 O(1) 操作 + 偶尔随机访问"的场景。

**面试怎么问**："deque 和 vector 有什么区别？""deque 底层结构是怎样的？""deque 有 push_front 吗？"

**用例 / 示例**：

```cpp
#include <deque>
using namespace std;

deque<int> d;
d.push_back(1);      // 尾部 O(1)
d.push_front(2);     // 头部 O(1)  ← deque 独有，vector 没有 push_front
d.pop_front();       // 头部删除 O(1)
int x = d[0];        // 随机访问 O(1)，但要两级跳转，略慢于 vector
```

对比表：

| 对比项 | vector | deque |
| --- | --- | --- |
| 结构 | 单一连续数组 | 分段连续缓冲区 + 中控器（map 指针数组） |
| 头部操作 | O(n) | O(1) |
| 尾部操作 | O(1) 摊还 | O(1) |
| 随机访问 | O(1) 最快 | O(1) 略慢（两级寻址） |
| 扩容 | 整体搬迁、迭代器全失效 | 新增缓冲区，已有元素不动、迭代器不失效 |
| 内存 | 连续一整块，cache 友好 | 分段，内存碎片容忍度好 |
| 适用场景 | 尾部操作 + 频繁随机访问 | 首尾都要 O(1) + 偶尔随机访问（如任务队列） |

**关联场景**：通用——生产者-消费者任务队列、滑动窗口场景用 deque；面试常问"为什么 deque 的首尾迭代器在中间插入时不失效"（分段结构，元素不搬家）。

---

### 52. STL 各容器底层数据结构与复杂度总览

**一句话要点**：vector=动态数组、list=双向链表、deque=分段数组、stack/queue=容器适配器（默认 deque 封装）、priority_queue=堆（vector+heap 算法）、set/map=红黑树（O(logN)）、unordered_*=哈希表（均摊 O(1)）；背下这张表，容器选型题直接套。

**面试怎么问**："map 的底层是什么？复杂度多少？""priority_queue 为什么 top 是 O(1)？""unordered_map 查找复杂度？"

**用例 / 示例**：

```text
| 容器 | 底层结构 | 插入 | 删除 | 查找/访问 | 说明 |
| --- | --- | --- | --- | --- | --- |
| vector | 动态数组 | 尾 O(1) 摊还，中间 O(n) | 尾 O(1)，中间 O(n) | 随机 O(1) | 连续内存 |
| list | 双向链表 | O(1)（已知位置） | O(1)（已知位置） | 查找 O(n) | 无随机访问 |
| deque | 分段连续缓冲 | 首尾 O(1) | 首尾 O(1) | 随机 O(1) | 两端操作 |
| stack / queue | deque 封装（默认） | 顶/尾 O(1) | 顶/头 O(1) | 只访问两端 O(1) | 容器适配器 |
| priority_queue | 堆（vector + heap 算法） | push O(logN) | pop O(logN) | top O(1) | 默认大顶堆 |
| set / multiset | 红黑树 | O(logN) | O(logN) | O(logN) | 键有序、唯一 |
| map / multimap | 红黑树 | O(logN) | O(logN) | O(logN) | 按键有序 |
| unordered_set / unordered_map | 哈希表 | 均摊 O(1) | 均摊 O(1) | 均摊 O(1) | 无序、冲突时退化 |
```

**关联场景**：通用——容器复杂度总表是 STL 面试地基；后续知识点 53-58 都是对这张表的展开，先背表再理解原理。

---

### 53. map 与红黑树

**一句话要点**：map 底层是红黑树（自平衡二叉搜索树）——根黑、红节点子必黑、各路径黑节点数相同，保证树高 O(logN)，因此插入/删除/查找都是 O(logN)；map 按键自动有序、支持 lower_bound 等范围查找；红黑树节点含左右孩子指针、父指针和颜色位，空间开销比哈希表大；set 同理（只有键）。

**面试怎么问**："map 底层是什么？为什么 O(logN)？""红黑树有哪些性质？""map 怎么找大于某个键的第一个元素？"

**用例 / 示例**：

```cpp
#include <map>
using namespace std;

// 红黑树五性质（简述）：
// ① 每个节点是红色或黑色
// ② 根节点是黑色
// ③ 红色节点的子节点必须是黑色（红节点不能连续）
// ④ 每个叶子（NIL 空节点）是黑色
// ⑤ 从任一节点到其叶子节点的所有路径，黑节点个数相同
// 由 ③⑤ 推出：最长路径 ≤ 2 × 最短路径 → 树高 O(logN) → 操作 O(logN)

map<int, string> m;
m[1] = "one";              // 插入：O(logN)
m[3] = "three";
m[2] = "two";
// map 按键自动有序：遍历输出 1→2→3
for (auto& kv : m) { /* kv.first 升序 */ }

auto it = m.find(2);           // 查找：O(logN)，返回迭代器或 end()
auto lo = m.lower_bound(2);    // 第一个 ≥ 2 的元素（范围查找）
auto hi = m.upper_bound(2);    // 第一个 > 2 的元素
// lower_bound/upper_bound 做区间查询是"有序"的红黑树独有优势

// 空间开销：红黑树节点含左/右孩子指针 + 父指针 + 颜色位 + 键值对
// → 比 vector<pair>、哈希表都大；set 同理（节点只有键）
// 对比 unordered_map（哈希表）更紧凑但无序（见知识点 54）
```

**关联场景**：通用——与数据结构（二叉搜索树、自平衡树）联动；面试常问"为什么不用 AVL 树"（红黑树插入删除调整次数更少、工程实现更优）。

---

### 54. unordered_map vs map（unordered_set vs set 同理）

**一句话要点**：底层不同——unordered_map 是哈希表、map 是红黑树；unordered 无序但均摊 O(1)，map 有序但 O(logN)；哈希表有冲突与 rehash（扩容重哈希、迭代器失效）；需要有序遍历/范围查询用 map，只做快速按键查找/计数用 unordered_map。

**面试怎么问**："map 和 unordered_map 区别？""unordered_map 底层怎么处理冲突？""什么时候用哪个？"

**用例 / 示例**：

```cpp
#include <map>
#include <unordered_map>
using namespace std;

map<int, string> m;              // 红黑树：按键有序，O(logN)
unordered_map<int, string> um;   // 哈希表：无序，均摊 O(1)

// 有序性：
// map 遍历按键升序；支持 lower_bound/upper_bound 范围查询
// unordered_map 遍历顺序无意义（按桶排列），不支持范围查询

// 复杂度：
// map：      insert/erase/find 都是 O(logN)
// unordered：insert/erase/find 均摊 O(1)；哈希冲突严重时退化 O(n)

// 哈希表机制（unordered）：
// ① 键经哈希函数 → 桶下标，桶内冲突用链表（长链时转红黑树）
// ② 负载因子过高触发 rehash（扩容 + 全部重新哈希），迭代器失效
// ③ 自定义类型作键要提供 std::hash 特化与 operator==

// 选择原则：
// 需要有序遍历 / 范围查询 / 比较器逻辑 → map
// 只做按键快速查找 / 字典 / 计数（频率统计）→ unordered_map 更快
// 工程：配置字典、日志映射用 unordered；需要排序输出时用 map
```

**关联场景**：通用——选型高频题；车联网中间件统计各设备上报次数、消息去重用 unordered_map，按设备 ID 排序输出时用 map。

---

### 55. 迭代器删除元素的注意事项

**一句话要点**：连续内存容器（vector/deque/string）erase 会使被删位置之后的所有迭代器失效，必须用 erase 的返回值接住下一个迭代器；节点型容器（list/map/set）删除只影响被删节点本身，其他迭代器仍有效，C++11 起 erase 统一返回下一个迭代器，循环删除直接接住即可。

**面试怎么问**："循环删除 vector 元素怎么删？""map 遍历中删除元素安全吗？""erase 返回值是做什么的？"

**用例 / 示例**：

```cpp
#include <vector>
#include <map>
#include <list>
using namespace std;

// —— vector：删除必须用 erase 返回值接住 ——
vector<int> v{1, 2, 3, 4, 5};
for (auto it = v.begin(); it != v.end(); ) {
    if (*it % 2 == 0)
        it = v.erase(it);      // 正确：erase 返回被删元素的下一个迭代器
    else
        ++it;                  // 不删除才 ++
}
// 错误写法：erase 后继续 ++it → it 已失效（后续元素整体前移）→ 未定义行为

// —— map/set：删除当前元素不影响其他迭代器（红黑树节点彼此独立）——
map<int, int> m{{1,1},{2,2},{3,3}};
for (auto it = m.begin(); it != m.end(); ) {
    if (it->first == 2)
        it = m.erase(it);      // C++11 起 erase 返回下一个，直接接住
    else
        ++it;
}
// 老写法（C++03）：先 it++ 记录下一个，再 erase(前一个)；
// 现在统一用返回值即可

// —— list：两种写法都行（节点独立，删除不影响其他迭代器）——
list<int> l{1, 2, 3};
auto it = l.begin();
l.erase(it);       // 其他迭代器仍有效

// 核心结论：连续内存容器 erase 使被删位置之后的迭代器全部失效，
// 必须用返回值；节点型容器删除只影响被删节点本身
```

**关联场景**：通用——手撕题常错点（先删后 ++ 是经典 bug）；与知识点 49/50（迭代器失效）联动；面试可答"统一用 erase 返回值，C++11 起所有容器都支持"。

---

### 56. 为什么 list 需要自己的 sort

**一句话要点**：STL 通用 std::sort 要求随机访问迭代器（快排/堆排需要 it+n 与随机交换），list 只有双向迭代器（只能 ++/--），所以编译不过；list 自带成员函数 list::sort，内部用归并排序（只需要顺序访问 + 改节点指针），O(NlogN) 且稳定；这是"算法与容器分离"泛型设计下的例外。

**面试怎么问**："为什么 list 不能用 std::sort？""list::sort 用的什么排序？"

**用例 / 示例**：

```cpp
#include <list>
#include <algorithm>
using namespace std;

list<int> l{3, 1, 2};
// sort(l.begin(), l.end());        // 错误：编译不过！
// 原因：std::sort 要求随机访问迭代器（要支持 it + n 跳转、
//       快速交换元素），list 只有双向迭代器（只能 ++/--）

l.sort();                          // 正确：list 自己的成员函数 sort
// list::sort 内部用自底向上的归并排序：
// 归并只需顺序访问 + 改节点指针，双向迭代器足够
// 复杂度 O(N logN)，且是稳定排序

// 设计背景：STL 是"算法与容器分离"的泛型设计——
// 同一份 std::sort 对 vector/deque/array 通用；
// list 因迭代器能力不足成为例外，需要容器自带的成员函数
// 其他同类例外：list::merge / list::unique / list::reverse / list::remove
```

**关联场景**：通用——考察迭代器分类（随机访问 vs 双向 vs 前向）与泛型设计理念；面试加分点："归并排序对链表 cache 不友好但无需随机访问，是链表排序的合理选择"。

---

### 57. priority_queue 底层

**一句话要点**：priority_queue 是容器适配器，底层用 vector 存储 + 堆算法（make_heap/push_heap/pop_heap）维护完全二叉堆，默认大顶堆（top 返回最大值）；push/pop 是 O(logN)、top 是 O(1)；自定义比较器（如 greater 实现小顶堆）决定优先级顺序；不能遍历，只能访问 top。

**面试怎么问**："priority_queue 底层是什么？""top 为什么 O(1)？""怎么实现小顶堆？"

**用例 / 示例**：

```cpp
#include <queue>
#include <vector>
#include <functional>
using namespace std;

// 默认大顶堆：top() 返回最大值
priority_queue<int> pq;        // 底层：vector + 堆算法
pq.push(3);                    // push：O(logN)（上浮调整）
pq.push(1);
pq.push(5);
int t = pq.top();              // top：O(1)，返回 5（根节点就是最大）
pq.pop();                      // pop：O(logN)（堆顶下沉调整）

// 小顶堆：用 greater 比较器
priority_queue<int, vector<int>, greater<int>> min_pq;
min_pq.push(3); min_pq.push(1);
// min_pq.top() == 1（最小）

// 自定义类型需要自定义比较（按优先级）：
// struct Task { int pri; };
// auto cmp = [](const Task& a, const Task& b) { return a.pri < b.pri; };
// priority_queue<Task, vector<Task>, decltype(cmp)> tq(cmp);

// 注意：priority_queue 是容器适配器，只能访问 top，不能遍历
// 适用场景：任务调度（按优先级取任务）、Top-K 问题、中位数维护
```

**关联场景**：车联网中间件——消息/任务按优先级调度（紧急告警先处理）；面试常问"Top-K 问题为什么用堆"（O(NlogK) 优于全排序）。

---

### 58. 为什么 vector 扩容不在原空间后面继续分配

**一句话要点**：旧空间后面的堆内存不归 vector 控制，很可能已被其他对象占用；vector 的契约是"元素连续存放"（保证 [] 随机访问 O(1)），只有拿到一整块更大的连续内存才行；堆分配器不保证就地扩展，所以标准做法是整体搬迁到新的连续大块，旧迭代器/指针/引用全部失效。

**面试怎么问**："vector 扩容为什么搬家而不是原地扩展？""realloc 不也能扩展吗？"

**用例 / 示例**：

```cpp
#include <vector>
using namespace std;

vector<int> v;
v.push_back(1);
// 扩容时为什么不在旧地址后面"接着扩"？
// ① 旧空间后面的堆内存不归 vector 管：malloc/new 分配时，
//    后面很可能已经被其他对象占用（另一个 vector、string 等）
// ② vector 的承诺是"元素连续存放"——只有一整块更大的连续内存，
//    才能保证 v[i] 用"起始地址 + 下标"直接寻址（随机访问 O(1)）
// ③ 堆分配器不提供"就地扩展"的通用保证：
//    realloc 也可能搬家（先分配新块再拷贝），无法依赖
// ④ 所以标准做法：新分配 2 倍大小的大块连续空间 → 拷贝/移动元素
//    → 释放旧空间（见知识点 50），旧迭代器/指针/引用全部失效

// 设计推论：
// · 频繁 push_back 前先 reserve() 预分配，减少扩容搬移次数
// · 扩容搬移本身 O(n)，但翻倍策略使 push_back 均摊 O(1)
// · 想要"插入不失效"且"内存不搬"用 list/deque（见知识点 49/51）
```

**关联场景**：通用——底层原理追问题，与知识点 50 联动；面试常从"为什么迭代器会失效"反推"因为元素搬家了，而搬家是因为拿不到更大的连续空间"。

---

### 59. typedef 与 #define 的区别

**一句话要点**：typedef 是编译期由编译器处理、遵循作用域规则、有严格类型检查的类型别名；#define 是预处理期纯文本替换、全局生效易污染、无类型检查易产生副作用；典型差异：typedef int* PINT 定义的是"指针类型"，而 #define PINT int* 只是文本替换，PINT a, b 中 b 会被展开成 int b 而不是指针。

**面试怎么问**："typedef 和 #define 有什么区别？""#define PINT int* 之后 PINT a, b 中 b 是什么类型？""typedef 能替代 #define 定义常量吗？"

**用例 / 示例**：

```cpp
#include <iostream>

// ① typedef：编译期类型别名，编译器认识，参与类型检查
typedef int* PINT_T;
PINT_T a, b;          // a、b 都是 int*（指针）

// ② #define：预处理期纯文本替换，编译器看到的已是替换后的代码
#define PINT_M int*
PINT_M c, d;          // 展开成 int* c, d; -> c 是 int*，d 是 int（陷阱！）
// d = &x;            // 编译错误：d 是 int 不是指针

// ③ 作用域差异
void f() {
    typedef int LocalInt;   // 块作用域内有效
    // #define 没有作用域概念：宏从定义处到文件结束全局生效
}
// LocalInt 在函数外不可见；宏若未 #undef 则一直污染后续代码

// ④ 类型检查差异：typedef 是"类型"，可参与重载决议/模板推导；
//    #define 无类型检查，类型写错不会报错，只在运行时暴露

// ⑤ #define 能做而 typedef 不能做的：定义常量/表达式
#define BUFSZ (64)          // 常量：typedef 不能做

// 实践建议：类型别名用 typedef/using；常量用 constexpr/const；
// 宏只保留给条件编译(#ifdef)、头文件保护等无法替代的场景
```

**关联场景**：通用——C/C++ 基础必考对比题；嵌入式老代码常见 #define 定义类型/常量，面试官常借 "PINT a, b" 陷阱考察"预处理 vs 编译期"的本质区别。

---

### 60. emplace_back 与 push_back 的区别

**一句话要点**：push_back 接收"已构造好的对象"再拷贝/移动到容器末尾；emplace_back 接收构造参数、在容器内存中就地构造，绕开临时对象，复杂对象省一次拷贝/移动。注意点：emplace_back 用完美转发，可能意外匹配到错误构造函数；花括号初始化有歧义（如 {1, 2}）；基本类型两者差异可忽略；push_back(std::move(x)) 与 emplace_back 效果接近。

**面试怎么问**："emplace_back 和 push_back 有什么区别？""emplace_back 一定能提升性能吗？""{1, 2} 传给 emplace_back 会怎样？"

**用例 / 示例**：

```cpp
#include <vector>
#include <string>
#include <iostream>
using namespace std;

struct Big {
    string name;
    explicit Big(const string& n) : name(n) {}         // 构造函数
    Big(const Big& o) : name(o.name) { cout << "copy\n"; }
    Big(Big&& o) noexcept : name(std::move(o.name)) { cout << "move\n"; }
};

vector<Big> v;
v.reserve(8);

// push_back：先构造临时对象 -> 再拷贝/移动进容器（多一次构造）
v.push_back(Big("a"));     // 临时对象 + move（右值走移动构造）

Big b("b");
v.push_back(b);            // 拷贝构造（b 是左值）——多一次 copy

// emplace_back：直接把参数转发给构造函数，容器内就地构造
v.emplace_back("c");       // 零拷贝零移动：只在容器内存里构造一次

// 性能结论：复杂对象 emplace_back 省一次临时对象的构造+移动；
// 基本类型（int 等）差异可忽略，两者差不多

// 注意 1：完美转发可能匹配到"错误"的构造函数
// v.emplace_back(b);                  // 转发左值 b -> 匹配拷贝构造
// v.emplace_back(std::move(b));       // 匹配移动构造

// 注意 2：花括号初始化歧义
// vector<vector<int>> vv;
// vv.emplace_back({1, 2});            // 可能解析歧义/编译错
// vv.push_back({1, 2});               // push_back 明确 initializer_list，OK

// 注意 3：explicit 构造函数只能靠 emplace_back 就地构造
// v.emplace_back("d");                // OK（就地构造）
// v.push_back("d");                   // 编译错：string 隐式转 Big 被 explicit 禁止
```

**关联场景**：车联网中间件——高频构建带字符串/容器的消息对象（CAN 报文结构体、日志条目、地图瓦片），用 emplace_back 减少临时对象构造；面试常追"emplace 一定更快吗""为什么说基本类型没差别"。
