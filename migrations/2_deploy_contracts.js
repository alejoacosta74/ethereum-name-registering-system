const Registrar = artifacts.require("Registrar");
const Token = artifacts.require("Token");
const toWei = function (n) {
	return web3.utils.toWei(n, 'ether');
      }

module.exports = async function (deployer, network, accounts) {
    let user = accounts[1], user2 = accounts[3], frontRunner = accounts[2];
    await deployer.deploy(Token, "AVD Token", "AVD");
    const token = await Token.deployed();
    await token.mint(user, toWei('100'));
    await token.mint(user2, toWei('100'));
    await token.mint(frontRunner, toWei('100'));
    await deployer.deploy(Registrar, token.address);
}