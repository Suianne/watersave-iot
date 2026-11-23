#ifndef WATERSAVE_TEST_FRAMEWORK_H
#define WATERSAVE_TEST_FRAMEWORK_H

// Mini framework de testes (sem dependencias): TEST(nome) { CHECK(...); }

#include <stdio.h>

#include <vector>

struct TestCase {
    const char* name;
    void (*fn)();
};

inline std::vector<TestCase>& testRegistry() {
    static std::vector<TestCase> registry;
    return registry;
}

inline int& currentFailures() {
    static int failures = 0;
    return failures;
}

struct TestRegistrar {
    TestRegistrar(const char* name, void (*fn)()) { testRegistry().push_back({name, fn}); }
};

#define TEST(name)                                         \
    static void name();                                    \
    static TestRegistrar registrar_##name(#name, name);    \
    static void name()

#define CHECK(cond)                                                          \
    do {                                                                     \
        if (!(cond)) {                                                       \
            printf("    FALHOU %s:%d  %s\n", __FILE__, __LINE__, #cond);     \
            ++currentFailures();                                             \
        }                                                                    \
    } while (0)

#define CHECK_EQ(actual, expected)                                                    \
    do {                                                                              \
        const long long a_ = static_cast<long long>(actual);                          \
        const long long e_ = static_cast<long long>(expected);                        \
        if (a_ != e_) {                                                               \
            printf("    FALHOU %s:%d  %s == %s  (obtido %lld, esperado %lld)\n",      \
                   __FILE__, __LINE__, #actual, #expected, a_, e_);                   \
            ++currentFailures();                                                      \
        }                                                                             \
    } while (0)

#define CHECK_NEAR(actual, expected, tolerance)                                       \
    do {                                                                              \
        const double a_ = static_cast<double>(actual);                                \
        const double e_ = static_cast<double>(expected);                              \
        const double d_ = a_ > e_ ? a_ - e_ : e_ - a_;                                \
        if (d_ > static_cast<double>(tolerance)) {                                    \
            printf("    FALHOU %s:%d  %s ~ %s  (obtido %f, esperado %f)\n",           \
                   __FILE__, __LINE__, #actual, #expected, a_, e_);                   \
            ++currentFailures();                                                      \
        }                                                                             \
    } while (0)

#endif  // WATERSAVE_TEST_FRAMEWORK_H
