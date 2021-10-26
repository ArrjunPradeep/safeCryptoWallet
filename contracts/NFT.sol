// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract NFT is ERC721URIStorage {

    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;

    address contractAddress; // MarketPlace Address

  event newToken(address indexed _from, uint256 _tokenId, string _uri);

    // Initialize the MarketPlace Address
    constructor(address marketplaceAddress) ERC721("CryptoInsider","CI") {
        contractAddress = marketplaceAddress;
    }

    // For Minting New Tokens
    function createToken(string memory tokenURI) public returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, tokenURI);
        setApprovalForAll(contractAddress, true); // Give the marketplace, the approval to transact this token between users 
        emit newToken(msg.sender, newItemId, tokenURI);
        return newItemId;
    }

    

    

}

