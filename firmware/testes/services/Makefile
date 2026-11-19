# Testes automatizados da camada de servico (rodam no PC, sem ESP32).
#   make test        compila e roda
#   make test-san    o mesmo com AddressSanitizer e UBSan
#   make clean

CXX ?= g++
CXXFLAGS ?= -std=c++11 -Wall -Wextra -Wpedantic -g -O1
SERVICES := ../../WaterSave/src/services
SOURCES := $(wildcard $(SERVICES)/*.cpp)
TESTS := run_tests.cpp test_controle.cpp test_falhas.cpp test_infra.cpp
HEADERS := $(wildcard $(SERVICES)/*.h) test_framework.h bench.h

.PHONY: test test-san clean

test: build/run_tests
	./build/run_tests

test-san: build/run_tests_san
	./build/run_tests_san

build/run_tests: $(SOURCES) $(TESTS) $(HEADERS)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -o $@ $(SOURCES) $(TESTS)

build/run_tests_san: $(SOURCES) $(TESTS) $(HEADERS)
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -fsanitize=address,undefined -fno-sanitize-recover=undefined -o $@ $(SOURCES) $(TESTS)

clean:
	rm -rf build
