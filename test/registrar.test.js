const Registrar = artifacts.require("Registrar");
const Token = artifacts.require("Token");
const {expectEvent, expectRevert} = require("@openzeppelin/test-helpers");
const { current } = require("@openzeppelin/test-helpers/src/balance");
const toWei = function (n) {
	return web3.utils.toWei(n, 'ether');
      }
const sleep = function (ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
      }


contract("Registrar", (accounts) => {

  let registrar, token, user = accounts[1], user2 = accounts[3], frontRunner = accounts[2], deployer = accounts[0], receipt, price, order, record; 

  before(async ()=>{
    token = await Token.new("AVD Token", "AVD", {from: deployer});
    await token.mint(user, toWei('100'));
    await token.mint(user2, toWei('100'));
    await token.mint(frontRunner, toWei('100'));
    registrar = await Registrar.new(token.address, {from: deployer});
  })

  describe ("Use Case 1: USER1 registers a new name 'example.com' ", async ()=>{
    it("should provide price corresponding to 11 characters: 'example.com'", async ()=>{
      price = await registrar.getPrice("example.com", {from: user});
      assert.equal(price.toString(), '11000', "price does not match name length of 11 characters");
    })

    it("should provide a order number to user and front runner", async ()=>{
	await registrar.getOrderNumber({from: user});
	order = await registrar.myOrder({from: user});
	assert.equal(order.toString(),"1", "wrong order number provided" )
	await registrar.getOrderNumber({from: frontRunner});
	order = await registrar.myOrder({from: frontRunner});
	assert.equal(order.toString(),"2", "wrong order number provided" )
    })

    it ("should allow front runner to register 'example.com'", async ()=>{
	await token.approve(registrar.address, price, {from: frontRunner});
	await registrar.registerName('example.com', {from: frontRunner});
	record =  await registrar.getNameRecord('example.com');
	assert.equal(record.owner,frontRunner, "wrong 'name' owner" )
    })
    it ("should allow user to register 'example.com' after front runner", async ()=>{
	await token.approve(registrar.address, price, {from: user});
	await registrar.registerName('example.com', {from: user});
	record =  await registrar.getNameRecord('example.com');
	assert.equal(record.owner,user, "wrong 'name' owner" )
    })
    it ("should revert when front runner attemps to register 'example.com'", async ()=>{
	await token.approve(registrar.address, price, {from: frontRunner});
	await expectRevert(
		registrar.registerName('example.com', {from: frontRunner}),
		"reservation without orderNumber not allowed",
	);
	await registrar.getOrderNumber({from: frontRunner});
	await expectRevert(
		registrar.registerName('example.com', {from: frontRunner}),
		"name already registered",
	);
    })
  })

  describe ("Use Case 2: USER2 registers 'example.com' after it expires", async ()=>{
    it("should revert when attempting registration without order number", async ()=>{
	await expectRevert(
		registrar.registerName('example.com', {from: user2}),
		"reservation without orderNumber not allowed",
		);
    });
    it("should revert when attempting registration if registered name is not expired", async ()=>{
	await registrar.getOrderNumber({from: user2});
	await expectRevert(
		registrar.registerName('example.com', {from: user2}),
		"name already registered",
		);
    });
    it("should revert when attempting registration with expired order number", async ()=>{
	await registrar.getOrderNumber({from: user2});
	console.log("--------------------\nSimulating expiration of 'order number' for USER2");
	for (let i=4; i>0;i--){
		await sleep(1000);
		console.log(`waiting ${i} seconds`);
	}
	console.log("---------------------")
	await expectRevert(
		registrar.registerName('example.com', {from: user2}),
		"order number expired",
		);
    });
    it("should allow registration after registration has expired", async ()=>{
	console.log("--------------------\nSimulating expiration of name 'example.com' for USER1");
	for (let i=10; i>0;i--){
		await sleep(1000);
		console.log(`waiting ${i} seconds`);
	}
	console.log("---------------------")
	await token.approve(registrar.address, price, {from: user2});
	await registrar.getOrderNumber({from: user2});
	await registrar.registerName('example.com', {from: user2});
	record =  await registrar.getNameRecord('example.com');
	assert.equal(record.owner, user2 , "wrong 'name' owner" )
    });
  });
  describe ("Use Case 3: USER2 issues renewal of 'example.com' renewal and USER1 unlocks balance", async ()=>{
    it("should allow current owner USER2 to renew 'example.com' before expiration", async ()=>{
	let currentRecord = await registrar.getNameRecord('example.com')
	await registrar.renewName('example.com', {from: user2});
	let newRecord = await registrar.getNameRecord('example.com');
	assert.equal(currentRecord.owner, user2 , "" );
	assert.equal(newRecord.owner, user2 , "" );
	assert(newRecord.expiresOn > currentRecord.expiresOn, "registration not renewed");
    });
  });
  describe ("Use Case 4: USER2 unlocks balance", async ()=>{
    it("should allow original owner USER1 to unlock balance after registration expired", async ()=>{
	console.log("--------------------\nSimulating expiration of name 'example.com' for USER2");
	for (let i=10; i>0;i--){
		await sleep(1000);
		console.log(`waiting ${i} seconds`);
	}
	console.log("---------------------")
	await registrar.unlockBalance('example.com', {from: user2});
	let allowance = await token.allowance(registrar.address, user, {from: user2});
	assert.equal(allowance.toString(), price.toString() , "balance not unlocked" )
    });
  });
});