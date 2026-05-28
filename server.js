const express = require('express');
const cors = require('cors');
const path = require('path'); // Pastikan modul path ini aktif

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Dasar
app.use(cors());
app.use(express.json());

// Melayani file HTML di root folder (index.html, loginpage.html, paymentgateway.html, admin.html)
app.use(express.static(path.join(__dirname)));

// Melayani aset gambar/css di dalam folder assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));

let transactionsMemory = [];

function readTransactions() {
    return transactionsMemory;
}

function writeTransactions(transactions) {
    transactionsMemory = transactions;
}

// Helper untuk menghasilkan ID transaksi yang unik
function generateTransactionId() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `TXN-${dateStr}-${randomNum}`;
}


// ==================== ENDPOINTS ====================

// 1. POST /api/checkout - Create a new transaction from cart items
app.post('/api/checkout', (req, res) => {
    try {
        const { items, subtotal } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Keranjang belanja kosong atau format tidak valid.' });
        }

        const transactions = readTransactions();
        const transactionId = generateTransactionId();

        // Calculate values
        const tax = Math.round(subtotal * 0.1); // 10% tax
        const shipping = 50000; // Flat exclusive shipping fee
        const total = subtotal + tax + shipping;

        const newTransaction = {
            id: transactionId,
            items,
            subtotal,
            tax,
            shipping,
            total,
            status: 'PENDING',
            paymentMethod: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        transactions.push(newTransaction);
        writeTransactions(transactions);

        console.log(`[Checkout] Transaksi baru dibuat: ${transactionId} - Total: Rp ${total}`);
        res.status(201).json(newTransaction);
    } catch (error) {
        console.error('Error in /api/checkout:', error);
        res.status(500).json({ error: 'Terjadi kesalahan pada server saat membuat checkout.' });
    }
});

// 2. GET /api/transactions - Get all transactions (for admin dashboard)
app.get('/api/transactions', (req, res) => {
    const transactions = readTransactions();
    // Return transactions sorted by newest first
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sortedTransactions);
});

// 3. GET /api/transactions/:id - Get specific transaction details
app.get('/api/transactions/:id', (req, res) => {
    const transactions = readTransactions();
    const transaction = transactions.find(t => t.id === req.params.id);

    if (!transaction) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }

    res.json(transaction);
});

// 4. POST /api/transactions/:id/pay - Simulate payment (updates status to SUCCESS)
app.post('/api/transactions/:id/pay', (req, res) => {
    const { paymentMethod } = req.body;
    const transactions = readTransactions();
    const transactionIndex = transactions.findIndex(t => t.id === req.params.id);

    if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }

    const transaction = transactions[transactionIndex];

    if (transaction.status !== 'PENDING') {
        return res.status(400).json({
            error: `Transaksi tidak dapat dibayar karena status saat ini adalah ${transaction.status}.`
        });
    }

    // Update status and payment method
    transaction.status = 'SUCCESS';
    if (paymentMethod) {
        transaction.paymentMethod = paymentMethod;
    }
    transaction.updatedAt = new Date().toISOString();

    transactions[transactionIndex] = transaction;
    writeTransactions(transactions);

    console.log(`[Payment] Transaksi ${transaction.id} BERHASIL dibayar menggunakan ${transaction.paymentMethod || 'Simulasi'}`);
    res.json({ message: 'Pembayaran sukses!', transaction });
});

// 5. POST /api/transactions/:id/cancel - Cancel transaction
app.post('/api/transactions/:id/cancel', (req, res) => {
    const transactions = readTransactions();
    const transactionIndex = transactions.findIndex(t => t.id === req.params.id);

    if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }

    const transaction = transactions[transactionIndex];

    if (transaction.status !== 'PENDING') {
        return res.status(400).json({
            error: `Transaksi tidak dapat dibatalkan karena status saat ini adalah ${transaction.status}.`
        });
    }

    transaction.status = 'CANCELLED';
    transaction.updatedAt = new Date().toISOString();

    transactions[transactionIndex] = transaction;
    writeTransactions(transactions);

    console.log(`[Cancel] Transaksi ${transaction.id} dibatalkan.`);
    res.json({ message: 'Transaksi berhasil dibatalkan.', transaction });
});

// 6. POST /api/transactions/:id/simulate-fail - Simulate payment failure
app.post('/api/transactions/:id/simulate-fail', (req, res) => {
    const transactions = readTransactions();
    const transactionIndex = transactions.findIndex(t => t.id === req.params.id);

    if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }

    const transaction = transactions[transactionIndex];

    if (transaction.status !== 'PENDING') {
        return res.status(400).json({
            error: `Transaksi tidak dapat ditolak karena status saat ini adalah ${transaction.status}.`
        });
    }

    transaction.status = 'FAILED';
    transaction.updatedAt = new Date().toISOString();

    transactions[transactionIndex] = transaction;
    writeTransactions(transactions);

    console.log(`[Failure] Transaksi ${transaction.id} gagal dibayar (simulasi).`);
    res.json({ message: 'Transaksi ditandai gagal.', transaction });
});

// Start Server (Hanya dijalankan jika file dieksekusi langsung secara lokal)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`==================================================`);
        console.log(`  Noiré Payment Gateway Backend Server is running! `);
        console.log(`  Local Endpoint: http://localhost:${PORT}        `);
        console.log(`==================================================`);
    });
}

// Tambahkan ini di bagian bawah server.js sebelum module.exports
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// WAJIB UNTUK VERCEL: Export app
module.exports = app;