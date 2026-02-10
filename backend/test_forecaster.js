/**
 * Test script for the Predictive Capacity Planning forecaster.
 * Generates synthetic trended data and validates forecasts.
 */

const { linearRegression, daysUntilFull } = require('./forecaster');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${msg}`);
    } else {
        failed++;
        console.error(`  ❌ ${msg}`);
    }
}

function approxEqual(a, b, tolerance = 0.1) {
    return Math.abs(a - b) <= tolerance;
}

// --- Test 1: Basic linear regression ---
console.log('\n📊 Test 1: Linear regression on perfect line y = 2x + 10');
{
    const points = [];
    for (let i = 0; i < 20; i++) {
        points.push({ x: i, y: 2 * i + 10 });
    }
    const reg = linearRegression(points);
    assert(reg !== null, 'Regression returned result');
    assert(approxEqual(reg.slope, 2, 0.001), `Slope is ~2 (got ${reg.slope})`);
    assert(approxEqual(reg.intercept, 10, 0.001), `Intercept is ~10 (got ${reg.intercept})`);
    assert(approxEqual(reg.r2, 1, 0.001), `R² is ~1 (got ${reg.r2})`);
}

// --- Test 2: Noisy upward trend ---
console.log('\n📊 Test 2: Noisy upward trend (slope ~0.5%/day)');
{
    const points = [];
    // Simulate 30 days of data, starting at 60% going up ~0.5%/day with noise
    for (let day = 0; day < 30; day++) {
        const noise = (Math.random() - 0.5) * 2; // ±1%
        points.push({ x: day, y: 60 + 0.5 * day + noise });
    }
    const reg = linearRegression(points);
    assert(reg !== null, 'Regression returned result');
    assert(reg.slope > 0.3 && reg.slope < 0.7, `Slope near 0.5 (got ${reg.slope.toFixed(3)})`);
    assert(reg.r2 > 0.8, `R² indicates good fit (got ${reg.r2.toFixed(3)})`);

    const days = daysUntilFull(reg, 29);
    assert(days !== null, 'daysUntilFull returned a value');
    // At day 29, usage ≈ 60 + 0.5*29 = 74.5%, remaining ~25.5%, at 0.5/day ≈ 51 days
    assert(days > 30 && days < 80, `Days until full is reasonable (got ${days.toFixed(1)})`);
    console.log(`  → Estimated ${days.toFixed(1)} days until full`);
}

// --- Test 3: Decreasing trend (should NOT warn) ---
console.log('\n📊 Test 3: Decreasing usage trend');
{
    const points = [];
    for (let day = 0; day < 20; day++) {
        points.push({ x: day, y: 80 - 0.3 * day });
    }
    const reg = linearRegression(points);
    assert(reg !== null, 'Regression returned result');
    assert(reg.slope < 0, `Slope is negative (got ${reg.slope.toFixed(3)})`);
    
    const days = daysUntilFull(reg, 19);
    assert(days === null, 'daysUntilFull returns null for decreasing trend');
}

// --- Test 4: Flat usage (slope ≈ 0) ---
console.log('\n📊 Test 4: Flat/stable usage');
{
    const points = [];
    for (let day = 0; day < 20; day++) {
        points.push({ x: day, y: 50 + (Math.random() - 0.5) * 0.1 });
    }
    const reg = linearRegression(points);
    assert(reg !== null, 'Regression returned result');
    assert(Math.abs(reg.slope) < 0.1, `Slope near zero (got ${reg.slope.toFixed(4)})`);
}

// --- Test 5: Rapid fill - should trigger warning ---
console.log('\n📊 Test 5: Rapid disk fill (should warn within 30 days)');
{
    const points = [];
    // Starting at 85%, growing 1%/day → full in 15 days
    for (let day = 0; day < 10; day++) {
        points.push({ x: day, y: 85 + 1.0 * day });
    }
    const reg = linearRegression(points);
    const days = daysUntilFull(reg, 9);
    assert(days !== null, 'daysUntilFull returned a value');
    assert(days < 30, `Warning triggered: full in ${days.toFixed(1)} days (< 30)`);
    console.log(`  → Disk full in ${days.toFixed(1)} days — WARNING`);
}

// --- Test 6: Insufficient data ---
console.log('\n📊 Test 6: Edge cases');
{
    const reg1 = linearRegression([]);
    assert(reg1 === null, 'Empty array returns null');

    const reg2 = linearRegression([{ x: 0, y: 50 }]);
    assert(reg2 === null, 'Single point returns null');
}

// --- Summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
} else {
    console.log('All tests passed! ✅');
    process.exit(0);
}
