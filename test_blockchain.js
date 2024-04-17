/***************************************************
 *  ██████╗███████╗ ██████╗██╗      █████╗ ██████╗ *
 * ██╔════╝██╔════╝██╔════╝██║     ██╔══██╗██╔══██╗*
 * ██║     █████╗  ██║     ██║     ███████║███████║*
 * ██║     ██╔══╝  ██║     ██║     ██╔══██║██╔══██║*
 * ╚██████╗██║     ╚██████╗███████╗██║  ██║██████╔╝*
 *  ╚═════╝╚═╝      ╚═════╝╚══════╝╚═╝  ╚═╝╚═════╝ *
 ***************************************************/


// const crypto = require("crypto"); SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
// var EC = require('elliptic').ec;
// var ec = new EC('secp256k1');

import crypto from "crypto"; const SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
import elliptic from 'elliptic';

const ec = new elliptic.ec('secp256k1');

const MINT_KEY_PAIR = ec.genKeyPair();
const MINT_PUBLIC_ADDRESS = MINT_KEY_PAIR.getPublic('hex')

const holderKeyPair = ec.genKeyPair();


// var CREATE_REWARD_ADDRESS= '';
// var rewardAddress = '';

var keyPair = ec.genKeyPair();





class Block {
    constructor(prevHash, data = []) {
        this.prevHash = prevHash;
        this.data = data;
        this.time = new Date();
        this.hash = this.calculateHash()
        this.mineVar = 0;
        console.log('data: ***', data)
    }

    calculateHash() {
        return SHA256(this.prevHash + JSON.stringify(this.data) + this.time + this.mineVar).toString();
    };

    mine(difficulty) {
        while(!this.hash.startsWith('0'.repeat(difficulty))) {
            this.mineVar ++;
            this.hash = this.calculateHash();
        }
    }

    hasValidTransaction(chain) {
        return this.data.every(transaction => transaction.isValid(transaction, chain))
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

        this.chain = [new Block('0000', [initialCoinRElease])];

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
                if(transaction.from === address) {
                    balance -= transaction.amount;
                    balance -= transaction.gas;
                }
                if(transaction.to === address) {
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

    addTransaction(transaction) {
        console.log(transaction.isValid(transaction, this))
        if(transaction.isValid(transaction, this)){
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

        if(this.transactions.length !== 0) {
            this.addBlock([rewardTransaction, ...this.transactions]);
        }
        this.transactions = [];
    }

    isValid(blockchain = this) {
        for(let i = 1; i < this.chain.length; i ++) {
            const currentBlock = this.chain[i];
            const prevBlock = this.chain[i - 1];
            if(currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }
            if(currentBlock.prevHash !== prevBlock.hash) {
                return false;
            }
            if(currentBlock.hasValidTransaction(blockchain)) {
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
        if(keyPair.getPublic('hex') === this.from) {
            this.signature = keyPair.sign(SHA256(this.from + this.to + this.amount + this.gas), "base64").toDER("hex");
        }
    }
    isValid(transaction, chain) {
        // console.log('chain: ', chain);
        // console.log('transaction', transaction)
        return(
            transaction.from &&
            transaction.to &&
            transaction.amount &&
            (chain.getBalance(transaction.from) >= transaction.amount + transaction.gas || ( transaction.from === MINT_PUBLIC_ADDRESS && transaction.amount === chain.reward)) &&
            ec.keyFromPublic(transaction.from, 'hex').verify(SHA256(transaction.from + transaction.to + this.amount + transaction.gas), transaction.signature)
        )
    }
}


const newTranstion = new BlockChain(4)

// số dư gốc: 10000

const girlFrientWallet = ec.genKeyPair();
const transaction = new Transaction(holderKeyPair.getPublic('hex'), girlFrientWallet.getPublic('hex'), 100, 10);
transaction.sign(holderKeyPair);
newTranstion.addTransaction(transaction);
newTranstion.mineTransaction(girlFrientWallet.getPublic('hex'));


console.log('số dư của bạn: ', newTranstion.getBalance(holderKeyPair.getPublic('hex')));
console.log('số dư của bạn gái: ', newTranstion.getBalance(girlFrientWallet.getPublic('hex')));

console.log(newTranstion)