// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "./Token.sol";

contract Registrar {

    Token public token;

    struct NameRecord {
        uint order;
        address owner;
        uint expiresOn;
    }

    struct OrderRecord {
        uint time;
        uint order;
    }
    
    mapping(string => NameRecord) private nameRecords; // Stores records for each registered 'name'
    mapping(address => OrderRecord) private orderRecords; // Stores records for each issued 'order' number
    mapping(address => uint) private balances;

    uint private counter; // counter is the source of 'order' number provided to users for 'name' registration
    uint private ORDER_TIMEOUT=3; // max allowed time for a user to register a name after receiving a 'order' number
    uint private NAME_EXPIRATION=6; //the time period after which the registration of a 'name' expires

    constructor (Token _token){
        token = _token;
    }

    /**
    @notice 'getOrderNumber' returns the 'order' number that allows user to register 'names'
    **/
    function getOrderNumber () public returns (uint) {
        counter ++;
        OrderRecord storage o = orderRecords[msg.sender];
        o.time = block.timestamp;
        o.order = counter;
        return counter;
    }
    
    /**
    @notice 'registerName' is used to register a new 'name'
    @dev caller should have a valid order number (i.e. not expired)
    @param name is the name to register
    **/
    function registerName (string memory name) public {
        // check that caller has already requested a order number
        require(orderRecords[msg.sender].order > 0, "reservation without orderNumber not allowed");
        
        // check caller's orderNumber has not expired
        require((block.timestamp - orderRecords[msg.sender].time) <= ORDER_TIMEOUT, "order number expired");

        if (nameRecords[name].owner != address(0x0) && nameRecords[name].expiresOn > block.timestamp){
            require(orderRecords[msg.sender].order < nameRecords[name].order, "name already registered");
        }
            
       if (
           nameRecords[name].owner == address(0x0) // name is not registered
           || 
           orderRecords[msg.sender].order < nameRecords[name].order // name is registered but caller has priority
           ||
           nameRecords[name].expiresOn < block.timestamp // name registration period has expired
           ) {
               //check caller has enough funds
               uint price = getPrice(name);
               require(token.allowance(msg.sender, address(this)) >= price, "not enough funds");
               token.transferFrom(msg.sender, address(this), price);
               balances[msg.sender] = price;
               NameRecord storage n = nameRecords[name];

               if (nameRecords[name].owner != address(0x0)) {
                    balances[n.owner] = 0;
                    token.approve(n.owner, price);// Unlock funds of original 'name' owner 
               }

               n.owner = msg.sender; // Assign name ownership to caller
               n.order = orderRecords[msg.sender].order; // Assign caller's order number to name's order number
               n.expiresOn = block.timestamp + NAME_EXPIRATION;
               orderRecords[msg.sender].order = 0; // Clear order number of current caller
               orderRecords[msg.sender].time = 0; 
        }
    }

    /**
    @notice 'renewName' is used by caller to keep name registered
    @dev 
    @param name is the 'name' to keep registered
    **/   
    function renewName (string memory name) public {
        //check caller is owner of name
        require(nameRecords[name].owner == msg.sender, "caller is not owner");
        //check caller ownership's has not expired
        require(nameRecords[name].expiresOn >= block.timestamp, "name registration has expired");
        nameRecords[name].expiresOn = block.timestamp + NAME_EXPIRATION + 1;
    }
    
    /**
    @notice 'unlockBalance' is used by caller to unlock token balance after 'name' registration has expired
    @dev if (balances[msg.sender] == 0) caller's balance has already been unlocked when other user
     registered the same 'name' after expiration
    @param name is the 'name' for which caller is owner
    **/
    function unlockBalance(string memory name) public {
        if (balances[msg.sender] > 0){
            require(nameRecords[name].owner == msg.sender, "not owner of provided name");
            require(nameRecords[name].expiresOn < block.timestamp, "cannot unlock balance before expiration");
            uint balance = balances[msg.sender];
            balances[msg.sender] = 0;
            token.approve(msg.sender, balance);
        }
    }

    /**
    @notice 'getPrice' returns the price for the provided 'name' as a function of its length
    @param name is the 'name' to register
    **/
    function getPrice (string memory name) public pure returns (uint){
        return ((bytes(name).length) * (10**3));
    }

    /**
    @notice 'queryName' returns FALSE if name is NOT registered
    @param name is the name to register
    **/
    function queryName(string memory name) view public returns (bool){
        if (nameRecords[name].owner == address(0x0)){
            return false;
        }
        return true;
    }

    /**
    @notice 'setOrderTimeout' sets the time for the validity period of 'order' numbers 
    @param timeOut
    **/
    function setOrderTimeout(uint timeOut) public {
        ORDER_TIMEOUT = timeOut;
    }

    function getOrderTimeout() view public returns (uint){
        return ORDER_TIMEOUT;
    }

    function getNameRecord(string memory name) public view returns (NameRecord memory){
        return nameRecords[name];
    }

    function myOrder () public view returns (uint){
        return orderRecords[msg.sender].order;
    }    

}