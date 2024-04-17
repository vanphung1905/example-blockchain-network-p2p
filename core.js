/***************************************************
 *  ██████╗███████╗ ██████╗██╗      █████╗ ██████╗ *
 * ██╔════╝██╔════╝██╔════╝██║     ██╔══██╗██╔══██╗*
 * ██║     █████╗  ██║     ██║     ███████║███████║*
 * ██║     ██╔══╝  ██║     ██║     ██╔══██║██╔══██║*
 * ╚██████╗██║     ╚██████╗███████╗██║  ██║██████╔╝*
 *  ╚═════╝╚═╝      ╚═════╝╚══════╝╚═╝  ╚═╝╚═════╝ *
 ***************************************************/



import { noise } from "@chainsafe/libp2p-noise";
import { mplex } from "@libp2p/mplex";
import { tcp } from "@libp2p/tcp";
import { webRTC } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import { webTransport } from "@libp2p/webtransport";
import { createLibp2p } from "libp2p";
import { kadDHT, removePublicAddressesMapper, removePrivateAddressesMapper } from "@libp2p/kad-dht";
import { bootstrap } from "@libp2p/bootstrap";
import { mdns } from '@libp2p/mdns';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { identify } from '@libp2p/identify';
import { yamux } from '@chainsafe/libp2p-yamux'
import { fromString } from 'uint8arrays/from-string'
import crypto from "crypto"; const SHA256 = message => crypto.createHash("sha256").update(message).digest("hex");
import elliptic from 'elliptic';
import { Block, BlockChain, Transaction, newBlockChain } from './blockChain.js';

const ec = new elliptic.ec('secp256k1');
// key Mint
const MINT_PRIVATE_ADDRESS = '2018c05e3ab002e7dceb5dc8887798b73483225c844e797f2aaccad13171d112';
const MINT_KEY_PAIR = ec.keyFromPrivate(MINT_PRIVATE_ADDRESS, 'hex');
const MINT_PUBLIC_ADDRESS = MINT_KEY_PAIR.getPublic('hex');
//key node
const privateKey = '95311b7d7cd69c49e346b0baed61a79699b59ad0cdc445e483d5377c322a0ea2';
const keyPair = ec.keyFromPrivate(privateKey, 'hex');
const publicKey = keyPair.getPublic('hex');

const topic = 'MY_BLOCKCHAIN';
var newData = {}; // :{id: string, data: obj}
var peerRandom = [];
var results_vote = [];
var is_listen_res_random = false;
var is_listen_result_vote = false;
var synchData = [];
var is_listen_synch_data = false;
var first_synch_data = false;
var res_synch_data = [];



const node = await createLibp2p({
  transports: [tcp(), webSockets(), webTransport(), webRTC()],
  connectionEncryption: [noise()],
  streamMuxers: [mplex(), yamux()],
  services: {
    aminoDHT: kadDHT({
      protocol: '/ipfs/kad/1.0.0',
      peerInfoMapper: removePrivateAddressesMapper
    }),
    pubsub: gossipsub(),
    identify: identify()
  },

  peerDiscovery: [
    // pubsubPeerDiscovery({
    //   interval: 10000,
    //   topics: topics, // defaults to ['_peer-discovery._p2p._pubsub']
    //   listenOnly: false
    // }),
    mdns()],

  addresses: {
    listen: ['/ip4/0.0.0.0/tcp/0']
  },
});
await node.start()

const peerId = node.peerId;
console.log(peerId);

node.addEventListener('peer:discovery', (evt) => {
  console.log('Discovered %s', evt.detail.id.toString()) // Log discovered peer
});
node.addEventListener('peer:connect', (evt) => {
  console.log('Connected to %s', evt.detail.toString()) // Log connected peer
})

node.services.pubsub.subscribe(topic)

node.services.pubsub.addEventListener('message', (message) => {
  // console.log(`${message.detail.topic}: ${new TextDecoder().decode(message.detail.data)}`)
  // console.dir(message.detail, {depth: 2})
  // console.log('*******', message.detail.from)

  const _message = JSON.parse(new TextDecoder().decode(message.detail.data));
  const messageFrom = message.detail.from;
  console.log(_message)
  console.log(_message.type)

  switch (_message.type) {
    case 'TYPE_NEW_DATA':
      newData = { id: _message.id, data: _message.data };
      sendNUmberRandom(_message.id);
      break;

    case 'TYPE_RES_RANDOM_NUMBER':
      if (_message.id === newData.id) {
        if (!is_listen_res_random) {
          is_listen_res_random = true;
          setTimeout(() => {
            vote()
          }, 2000);
        }
        peerRandom.push({ peerId: messageFrom, number: _message.numberRandom })
      }
      break;
    case 'TYPE_VOTE_PEER':
      if (_message.id === newData.id) {
        if (!is_listen_result_vote) {
          is_listen_result_vote = true;
          setTimeout(() => {
            handleResultVote()
          }, 2000);
        }
        results_vote.push(_message.peer.toString())
      }
      break;

    case 'TYPE_ADD_BLOCK':
      const bl = new Block();
      bl.prevHash = _message.data.prevHash;
      bl.time = new Date(_message.data.time);
      bl.mineVar = _message.data.mineVar;
      bl.hash = _message.data.hash;
      bl.data = _message.data.data.map((e) => {
        const tx = new Transaction(e.from, e.to, e.amount)
        tx.signature = e.signature
        tx.gas = e.gas
        return tx;
      })
      newBlockChain.validateAndAddBlock(bl);
      newData = {};
      console.log("done add Block");
      console.log(newBlockChain);
      break;

    case 'TYPE_SYNCH_DATA':
      if (!is_listen_synch_data) {
        is_listen_synch_data = true;
        setTimeout(() => {
          handleSyncData(synchData);
          is_listen_synch_data = false;
        }, 2000);
      }
      synchData.push(JSON.stringify(_message.data))
      break;

    case 'TYPE_REQ_SYNCH_DATA':
      const dataToSend = fromString(JSON.stringify({
        type: 'TYPE_RES_SYNCH_DATA',
        data: newBlockChain,
      }));
      node.services.pubsub.publish(topic, dataToSend)
      break;

    case 'TYPE_RES_SYNCH_DATA':
      if(!first_synch_data) {
        if (!is_listen_synch_data) {
          is_listen_synch_data = true;
          setTimeout(() => {
            handleSyncData(res_synch_data);
            is_listen_synch_data = false;
          }, 2000);
        }
        res_synch_data.push(JSON.stringify(_message.data))
      }
      else console.log('đã cập nhật data lần đầu')
  }

})

function sendNUmberRandom(id) {
  //random 0-100
  const numberRandom = Math.floor(Math.random() * 100)
  peerRandom.push({ peerId: peerId.toString(), number: numberRandom })
  const dataToSend = fromString(JSON.stringify({
    type: 'TYPE_RES_RANDOM_NUMBER',
    numberRandom: numberRandom,
    id
  }));
  node.services.pubsub.publish(topic, dataToSend)
}

function handleResultVote() {
  is_listen_result_vote = false;
  const select_peer = handleConsensus(results_vote);
  results_vote = [];
  console.log('handleResultVote: ', select_peer)
  if (select_peer === peerId.toString()) {
    mineTransaction()
  }
}

function handleConsensus(arr) {
  let counts = {};
  let maxCount = 0;
  let mostFrequentElement;

  for (let element of arr) {
    if (counts[element] === undefined) {
      counts[element] = 1;
    } else {
      counts[element]++;
    }

    if (counts[element] > maxCount) {
      maxCount = counts[element];
      mostFrequentElement = element;
    }
  }
  return mostFrequentElement;
}

function vote() {
  is_listen_res_random = false;
  const select = peerRandom.sort((a, b) => b.number - a.number)[0];
  const dataToSend = fromString(JSON.stringify({
    type: 'TYPE_VOTE_PEER',
    peer: select.peerId,
    id: newData.id
  }));
  console.log('peerRandom[0]: ', select)
  node.services.pubsub.publish(topic, dataToSend)
  peerRandom = [];
}
function mineTransaction() {
  const tx = new Transaction(newData.data.from, newData.data.to, newData.data.amount, newData.data.gas);
  tx.signature = newData.data.signature
  newBlockChain.addTransaction(tx)
  newBlockChain.mineTransaction(publicKey)
  const block = newBlockChain.getLastBlock();
  const dataToSend = fromString(JSON.stringify({
    type: 'TYPE_ADD_BLOCK',
    data: block,
  }));
  newData = {};
  node.services.pubsub.publish(topic, dataToSend)
}

function handleSyncData(synchData) {
  first_synch_data = true;
  const standard_data = handleConsensus(synchData);
  if (standard_data !== JSON.stringify(newBlockChain)) {
    const _standard_data = JSON.parse(standard_data)
    const blc = new BlockChain(_standard_data.difficulty)
    blc.reward = _standard_data.reward;
    for (let i = 1; i < _standard_data.chain.length; i++) {
      const bl = new Block();
      bl.prevHash = _standard_data.chain[i].prevHash;
      bl.time = new Date(_standard_data.chain[i].time);
      bl.mineVar = _standard_data.chain[i].mineVar;
      bl.hash = _standard_data.chain[i].hash;
      bl.data = _standard_data.chain[i].data.map((e) => {
        const tx = new Transaction(e.from, e.to, e.amount)
        tx.signature = e.signature
        tx.gas = e.gas
        return tx;
      })
      blc.validateAndAddBlock(bl);
    }
    newBlockChain.chain = blc.chain;
  }
  console.log('***synch_data: ', newBlockChain)
  console.log('check valid chain after synch data: ', newBlockChain.checkIsValidChain())
  synchData = [];
}


function sendMessageSynchData() {
  console.log(new Date());
  const dataToSend = fromString(JSON.stringify({
    type: 'TYPE_SYNCH_DATA',
    data: newBlockChain,
  }));
  node.services.pubsub.publish(topic, dataToSend)
}

function scheduleSynchData() {
  const intervalInMilliseconds = 10 * 60 * 1000; // 10 phút
  const currentTime = new Date();
  const timeToNextCall = Math.ceil(currentTime.getTime() / intervalInMilliseconds) * intervalInMilliseconds;
  const timeUntilNextCall = timeToNextCall - currentTime.getTime();

  setTimeout(function () {
    sendMessageSynchData();
    setInterval(sendMessageSynchData, intervalInMilliseconds);
  }, timeUntilNextCall);
}


scheduleSynchData();

const interval_fist_synch_data = setInterval(() => {
  if (node.services.pubsub.getSubscribers(topic).length > 0) {
    if (!first_synch_data) {
      const dataToSend = fromString(JSON.stringify({
        type: 'TYPE_REQ_SYNCH_DATA',
        data: '',
      }));
      node.services.pubsub.publish(topic, dataToSend)
      clearInterval(interval_fist_synch_data);
    }
  }
}, 5000);




/*
********************************************************************************************************************************************
      TEST
*/


const myWallet = ec.genKeyPair();
setTimeout(() => {

  const transaction = new Transaction(publicKey, myWallet.getPublic('hex'), 500, 10);
  transaction.sign(keyPair);
  const time = (new Date()).getTime()
  const dataToSend = fromString(JSON.stringify({
    type: 'TYPE_NEW_DATA',
    data: transaction,
    id: time
  }));
  newData = { id: time, data: JSON.parse(JSON.stringify(transaction)) };
  node.services.pubsub.publish(topic, dataToSend)
  sendNUmberRandom(newData.id)

}, 15000);
