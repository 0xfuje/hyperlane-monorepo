import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import {
  InterchainGasPaymaster,
  InterchainGasPaymaster__factory,
} from '../types';

const MESSAGE_ID =
  '0x6ae9a99190641b9ed0c07143340612dde0e9cb7deaa5fe07597858ae9ba5fd7f';
const DESTINATION_DOMAIN = 1234;
const GAS_PAYMENT_AMOUNT = 123456789;
const GAS_AMOUNT = 4444;
const REFUND_ADDRESS = '0xc0ffee0000000000000000000000000000000000';
const OWNER = '0xdeadbeef00000000000000000000000000000000';

describe('InterchainGasPaymaster', async () => {
  let paymaster: InterchainGasPaymaster, signer: SignerWithAddress;

  before(async () => {
    [signer] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const paymasterFactory = new InterchainGasPaymaster__factory(signer);
    paymaster = await paymasterFactory.deploy();
  });

  describe('#initialize', async () => {
    it('should not be callable twice', async () => {
      await expect(paymaster.initialize()).to.be.reverted;
    });
  });

  describe('#payForGas', async () => {
    it('deposits the value into the contract', async () => {
      const paymasterBalanceBefore = await signer.provider!.getBalance(
        paymaster.address,
      );

      await paymaster.payForGas(
        MESSAGE_ID,
        DESTINATION_DOMAIN,
        GAS_AMOUNT,
        REFUND_ADDRESS,
        {
          value: GAS_PAYMENT_AMOUNT,
        },
      );

      const paymasterBalanceAfter = await signer.provider!.getBalance(
        paymaster.address,
      );

      expect(paymasterBalanceAfter.sub(paymasterBalanceBefore)).equals(
        GAS_PAYMENT_AMOUNT,
      );
    });

    it('emits the GasPayment event', async () => {
      await expect(
        paymaster.payForGas(
          MESSAGE_ID,
          DESTINATION_DOMAIN,
          GAS_AMOUNT,
          REFUND_ADDRESS,
          {
            value: GAS_PAYMENT_AMOUNT,
          },
        ),
      )
        .to.emit(paymaster, 'GasPayment')
        .withArgs(MESSAGE_ID, GAS_AMOUNT, GAS_PAYMENT_AMOUNT);
    });
  });

  describe('#claim', async () => {
    it('sends the entire balance of the contract to the owner', async () => {
      // First pay some ether into the contract
      await paymaster.payForGas(
        MESSAGE_ID,
        DESTINATION_DOMAIN,
        GAS_AMOUNT,
        REFUND_ADDRESS,
        {
          value: GAS_PAYMENT_AMOUNT,
        },
      );

      // Set the owner to a different address so we aren't paying gas with the same
      // address we want to observe the balance of
      await paymaster.transferOwnership(OWNER);

      const ownerBalanceBefore = await signer.provider!.getBalance(OWNER);
      expect(ownerBalanceBefore).equals(0);
      const paymasterBalanceBefore = await signer.provider!.getBalance(
        paymaster.address,
      );
      expect(paymasterBalanceBefore).equals(GAS_PAYMENT_AMOUNT);

      await paymaster.claim();

      const ownerBalanceAfter = await signer.provider!.getBalance(OWNER);
      expect(ownerBalanceAfter).equals(GAS_PAYMENT_AMOUNT);
      const paymasterBalanceAfter = await signer.provider!.getBalance(
        paymaster.address,
      );
      expect(paymasterBalanceAfter).equals(0);
    });
  });
});
