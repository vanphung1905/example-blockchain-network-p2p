/***************************************************
 *  ██████╗███████╗ ██████╗██╗      █████╗ ██████╗ *
 * ██╔════╝██╔════╝██╔════╝██║     ██╔══██╗██╔══██╗*
 * ██║     █████╗  ██║     ██║     ███████║███████║*
 * ██║     ██╔══╝  ██║     ██║     ██╔══██║██╔══██║*
 * ╚██████╗██║     ╚██████╗███████╗██║  ██║██████╔╝*
 *  ╚═════╝╚═╝      ╚═════╝╚══════╝╚═╝  ╚═╝╚═════╝ *
 ***************************************************/


import crypto from "crypto"; const SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
import elliptic from 'elliptic';

const ec = new elliptic.ec('secp256k1');

const MINT_PRIVATE_ADDRESS = '2018c05e3ab002e7dceb5dc8887798b73483225c844e797f2aaccad13171d112';
const MINT_KEY_PAIR = ec.keyFromPrivate(MINT_PRIVATE_ADDRESS, 'hex');
const MINT_PUBLIC_ADDRESS = MINT_KEY_PAIR.getPublic('hex');

// const holderKeyPair = ec.genKeyPair();
const privateKey = '95311b7d7cd69c49e346b0baed61a79699b59ad0cdc445e483d5377c322a0ea2';
const holderKeyPair = ec.keyFromPrivate(privateKey, 'hex');
const publicKey = holderKeyPair.getPublic('hex');


var keyPair = ec.genKeyPair();

class Block {
    constructor(prevHash, data = [], isFirstBlock = false) {
        this.prevHash = prevHash;
        this.data = data;
        this.time = isFirstBlock ? '' : new Date();
        this.hash = Block.calculateHash(this)
        this.mineVar = 0;
        // console.log('data: ***', this)
    }

    static calculateHash(block) {
        return SHA256(block.prevHash + JSON.stringify(block.data) + block.time + block.mineVar).toString();
    };

    mine(difficulty) {
        while (!this.hash.startsWith('0'.repeat(difficulty))) {
            this.mineVar++;
            this.hash = Block.calculateHash(this);
        }
    }

    static hasValidTransaction(block, chain) {
        return block.data.every(transaction => Transaction.isValid(transaction, chain))
    }
}

class BlockChain {
    constructor(difficulty) {
        // const genesisBlock = new Block('0000', {
        //     from: '',
        //     to: '22222',
        //     amount: '10'
        // });

        const initialCoinRElease = new Transaction(MINT_PUBLIC_ADDRESS, holderKeyPair.getPublic('hex'), 1000)
        this.difficulty = difficulty;

        this.chain = [new Block('0000', [initialCoinRElease], true)];

        this.transactions = [];

        this.reward = 3;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    getBalance(address) {
        let balance = 0;
        this.chain.forEach(block => {
            block.data.forEach(transaction => {
                if (transaction.from === address) {
                    balance -= transaction.amount;
                    balance -= transaction.gas;
                }
                if (transaction.to === address) {
                    balance += transaction.amount;
                }
            })
        })
        return balance;
    }


    addBlock(data) {
        const lastBlock = this.getLastBlock();
        const newBlock = new Block(lastBlock.hash, data);
        newBlock.mine(this.difficulty);
        this.chain.push(newBlock);
    }

    validateAndAddBlock(block) {
        const lastBlock = this.getLastBlock();
        if (Block.hasValidTransaction(block, this)
            && block.prevHash === lastBlock.hash
            && block.hash === Block.calculateHash(block)) {
                this.chain.push(block);
        }
    }


    addTransaction(transaction) {
        if (Transaction.isValid(transaction, this)) {
            this.transactions.push(transaction);
        }
    }

    mineTransaction(rewardAddress) {
        let gas = 0;
        this.transactions.forEach(transaction => {
            gas += transaction.gas;
        })


        const rewardTransaction = new Transaction(MINT_PUBLIC_ADDRESS, rewardAddress, this.reward);
        rewardTransaction.sign(MINT_KEY_PAIR);

        if (this.transactions.length !== 0) {
            this.addBlock([rewardTransaction, ...this.transactions]);
        }
        this.transactions = [];
    }

    checkIsValidChain(blockchain = this) {
        for(let i = 1; i < this.chain.length; i ++) {
            const currentBlock = this.chain[i];
            const prevBlock = this.chain[i - 1];
            if(currentBlock.hash !== Block.calculateHash(currentBlock)) {
                return false;
            }
            if(currentBlock.prevHash !== prevBlock.hash) {
                return false;
            }
            if(!currentBlock.data.every(transaction => Transaction.checkIsvalid(transaction, blockchain))) {
                return false
            }
        }
        return true;
    }

    static isValid(blockchain) {
        for (let i = 1; i < blockchain.chain.length; i++) {
            const currentBlock = blockchain.chain[i];
            const prevBlock = blockchain.chain[i - 1];
            if (currentBlock.hash !== Block.calculateHash(currentBlock)) {
                return false;
            }
            if (currentBlock.prevHash !== prevBlock.hash) {
                return false;
            }
            if (!Block.hasValidTransaction(currentBlock, blockchain)) {
                return false
            }
        }

        return true;
    }
}

class Transaction {
    constructor(from, to, amount, gas = 0) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.gas = gas;
    }

    sign(keyPair) {
        if (keyPair.getPublic('hex') === this.from) {
            this.signature = keyPair.sign(SHA256(this.from + this.to + this.amount + this.gas), "base64").toDER("hex");
        }
    }
    static checkIsvalid(transaction, chain) {
        return (
            transaction.from &&
            transaction.to &&
            transaction.amount &&
            (transaction.from === MINT_PUBLIC_ADDRESS ? transaction.amount === chain.reward : true) &&
            ec.keyFromPublic(transaction.from, 'hex').verify(SHA256(transaction.from + transaction.to + transaction.amount + transaction.gas), transaction.signature)
        )
    }
    static isValid(transaction, chain) {
        return (
            transaction.from &&
            transaction.to &&
            transaction.amount &&
            (chain.getBalance(transaction.from) >= transaction.amount + transaction.gas || (transaction.from === MINT_PUBLIC_ADDRESS && transaction.amount === chain.reward)) &&
            ec.keyFromPublic(transaction.from, 'hex').verify(SHA256(transaction.from + transaction.to + transaction.amount + transaction.gas), transaction.signature)
        )
    }
}



// const newTranstion = new BlockChain(4)

// // số dư gốc: 10000

// const girlFrientWallet = ec.genKeyPair();
// const transaction = new Transaction(holderKeyPair.getPublic('hex'), girlFrientWallet.getPublic('hex'), 100, 10);
// transaction.sign(holderKeyPair);
// newTranstion.addTransaction(transaction);
// newTranstion.mineTransaction(girlFrientWallet.getPublic('hex'));


// console.log('số dư của bạn: ', newTranstion.getBalance(holderKeyPair.getPublic('hex')));
// console.log('số dư của bạn gái: ', newTranstion.getBalance(girlFrientWallet.getPublic('hex')));

// console.log(newTranstion)


const newBlockChain = new BlockChain(4)
export { Block, BlockChain, Transaction, newBlockChain };