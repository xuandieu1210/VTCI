const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('auth routes expose the original controller load error', () => {
    const originalLoad = Module._load;
    const expected = new Error('test missing dependency');
    Module._load = function (request, ...args) {
        if (request === '../controllers/authController') throw expected;
        return originalLoad.call(this, request, ...args);
    };
    try {
        assert.throws(() => require('../src/routes/authRoutes'), error => error === expected);
    } finally {
        Module._load = originalLoad;
    }
});

test('auth routes load all controller handlers', () => {
    const router = require('../src/routes/authRoutes');
    const createUser = router.stack.find(layer => layer.route?.path === '/users' && layer.route.methods.post);
    assert.ok(createUser);
    assert.equal(typeof createUser.route.stack.at(-1).handle, 'function');
});