#!/usr/bin/env node
/**
 * Test script for anomaly_detector.js using synthetic data.
 * Run: node backend/test_anomaly.js
 */

const { _internals } = require('./anomaly_detector');
const { mean, stddev, zScore } = _internals;

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ ${msg}`);
    failed++;
  }
}

function approx(a, b, eps = 0.01) {
  return Math.abs(a - b) < eps;
}

// --- Unit tests ---

console.log('\n📊 Testing mean()');
assert(mean([10, 20, 30]) === 20, 'mean([10,20,30]) === 20');
assert(mean([]) === 0, 'mean([]) === 0');
assert(mean([5]) === 5, 'mean([5]) === 5');

console.log('\n📊 Testing stddev()');
assert(approx(stddev([10, 10, 10], 10), 0), 'stddev of identical values === 0');
assert(stddev([1], 1) === 0, 'stddev of single value === 0');
// stddev([2,4,4,4,5,5,7,9], mean=5) ≈ 2.0
const testArr = [2, 4, 4, 4, 5, 5, 7, 9];
const testMean = mean(testArr);
const testSd = stddev(testArr, testMean);
assert(approx(testSd, 2.0, 0.1), `stddev([2,4,4,4,5,5,7,9]) ≈ 2.0 (got ${testSd.toFixed(3)})`);

console.log('\n📊 Testing zScore()');
assert(zScore(50, 50, 10) === 0, 'z-score of mean value === 0');
assert(zScore(80, 50, 10) === 3, 'z-score of 80 with mean=50, sd=10 === 3');
assert(zScore(20, 50, 10) === -3, 'z-score of 20 with mean=50, sd=10 === -3');
assert(zScore(100, 100, 0) === 0, 'z-score when sd=0 returns 0 (no div by zero)');

// --- Synthetic scenario test ---
console.log('\n📊 Testing anomaly detection scenario');

// Simulate: 50 data points ~30% CPU, then a spike to 95%
const normalCpu = Array.from({ length: 50 }, () => 30 + (Math.random() - 0.5) * 4);
const avg = mean(normalCpu);
const sd = stddev(normalCpu, avg);
const spikeZ = zScore(95, avg, sd);

console.log(`  Normal CPU: mean=${avg.toFixed(1)}, sd=${sd.toFixed(2)}`);
console.log(`  Spike value: 95%, z-score=${spikeZ.toFixed(2)}`);
assert(spikeZ > 3.0, `Spike z-score (${spikeZ.toFixed(2)}) > 3.0 threshold`);

// Normal value should NOT be anomalous
const normalZ = zScore(31, avg, sd);
assert(Math.abs(normalZ) < 3.0, `Normal value z-score (${normalZ.toFixed(2)}) < 3.0`);

// --- Summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('All tests passed! ✅\n');
