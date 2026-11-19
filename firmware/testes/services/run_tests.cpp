#include <stdio.h>

#include "test_framework.h"

int main() {
    int failedTests = 0;
    const std::vector<TestCase>& tests = testRegistry();

    for (const TestCase& test : tests) {
        currentFailures() = 0;
        test.fn();
        if (currentFailures() == 0) {
            printf("  ok     %s\n", test.name);
        } else {
            printf("  FALHA  %s\n", test.name);
            ++failedTests;
        }
    }

    printf("\n%d testes, %d falharam\n", static_cast<int>(tests.size()), failedTests);
    return failedTests == 0 ? 0 : 1;
}
