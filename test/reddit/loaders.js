import Promise from 'bluebird';
import { expect } from 'chai';
import DataLoader from 'dataloader';
import TestRPC from 'ethereumjs-testrpc';
import sinon from 'sinon';
import { waitForContract, waitForReceipt } from 'transaction-monad/lib/utils';
import uport from 'uport-registry';
import Web3 from 'web3';
import contracts from '../../src/contracts/development';
import { ProfileLoader } from '../../src/services/reddit/loaders';
import { IpfsProviderStub } from '../_utils/ipfs';

global.Promise = Promise;  // Use bluebird for better error logging during development.

const UPORT_PROFILE = '[{"payload":{"claim":{"account":[{"@type":"Account","service":"reddit","identifier":"natrius","proofType":"http","proofUrl":"https://www.reddit.com/r/UportProofs/comments/4s4ihf/i_control_ethereum_account/"}]},"subject":{"address":"0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1"}}}]';
const UPORT_PROFILE_HASH = 'QmWiN11H6ZgQY2ZVjwLrtDVeJ3uU2vKbVWmUz5jVr1xZ2k';

describe('loaders', () => {
  let registryAddress;
  let sender;

  before(async function () {
    const web3Provider = TestRPC.provider({ seed: 'TestRPC is awesome!' });
    const web3 = new Web3(web3Provider);
    const getAccounts = Promise.promisify(web3.eth.getAccounts);
    const accounts = await getAccounts();
    sender = accounts[0];

    // Deploy a registry.
    const deployTx = {
      from: sender,
      data: contracts.UportRegistry.binary,
    };
    const sendTransaction = Promise.promisify(web3.eth.sendTransaction);
    const deployHash = await sendTransaction(deployTx);
    registryAddress = await waitForContract(deployHash, web3Provider);

    // Stub an IPFS provider with profile data.
    const stubs = { add: sinon.stub(), cat: sinon.stub() };
    stubs.add.returns([null, UPORT_PROFILE_HASH]);
    stubs.cat.returns([null, UPORT_PROFILE]);
    const ipfsProvider = new IpfsProviderStub(stubs);

    // Register a profile for sender.
    uport.setWeb3Provider(web3Provider);
    uport.setIpfsProvider(ipfsProvider);
    const txhash = await uport.setAttributes(
      registryAddress, JSON.parse(UPORT_PROFILE), { from: sender });
    await waitForReceipt(txhash, web3Provider);
  });

  it('fetches profile', async function () {
    const loader = new ProfileLoader({ registryAddress });
    const profileData = await loader.load(sender);
    expect(profileData).to.deep.equal({
      address: sender,
      profile: JSON.parse(UPORT_PROFILE),
    });
  });
});