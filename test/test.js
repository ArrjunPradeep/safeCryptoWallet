const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NFTMarket", function () {

  before("Deployment", async() => {

    Market = await ethers.getContractFactory("NFTMarket");
    market = await Market.deploy();
    await market.deployed();
    marketAddress = market.address;

    NFT = await ethers.getContractFactory("NFT");
    nft = await NFT.deploy(marketAddress);
    await nft.deployed();
    nftContractAddress = nft.address;

  })

  it("Should create and execute market sales", async function () {

    let listingPrice = await market.getListingPrice();
    listingPrice = listingPrice.toString();

    const auctionPrice = ethers.utils.parseUnits('10','ether');

    // Creating Tokens
    let a = await nft.createToken("https://www.mytokenlocation.com");
    let b = await nft.createToken("https://www.mytokenlocation2.com");
    console.log("A:::", b);

    // Listing Token On Market
    await market.createMarketItem(nftContractAddress, 1, auctionPrice, { value: listingPrice});
    await market.createMarketItem(nftContractAddress, 2, auctionPrice, { value: listingPrice});

    const [_, buyerAddress] = await ethers.getSigners();

    await market.connect(buyerAddress).createMarketSale(nftContractAddress, 1, {value:auctionPrice});

    let items = await market.fetchMarketItems();

    items = await Promise.all(items.map(async i  => {
      const tokenUri = await nft.tokenURI(i.tokenId);
      let item = {
        price:i.price.toString(),
        tokenId:i.tokenId.toString(),
        seller:i.seller,
        owner:i.owner,
        tokenUri
      }
      return item;
    }));

    console.log(" :: ITEMS :: \n",items);

  });

  it("Listing Price - 0.025 ether", async() => {
    listingPrice = (await market.getListingPrice()).toString();
    listingPrice = await ethers.utils.formatEther(listingPrice);

    expect(listingPrice).to.equal('0.025');

  });

  it("List the Unsold NFTs", async() => {
    fetchMarketItems = await market.fetchMarketItems();
    
    fetchMarketItems = await Promise.all(fetchMarketItems.map(async i  => {
      tokenUri = await nft.tokenURI(i.tokenId);
      item = {
        price:i.price.toString(),
        tokenId:i.tokenId.toString(),
        seller:i.seller,
        owner:i.owner,
        tokenUri
      }
      return item;
    }));

    console.log(":: UNSOLD NFTS ::\n", item);
  })

  it("List My NFTs", async() => {
    fetchMyNFTs = await market.fetchMyNFTs();

    fetchMyNFTs = await Promise.all(fetchMyNFTs.map(async i  => {
      tokenUri = await nft.tokenURI(i.tokenId);
      item = {
        price:i.price.toString(),
        tokenId:i.tokenId.toString(),
        seller:i.seller,
        owner:i.owner,
        tokenUri
      }
      return item;
    }));

    console.log(":: MY NFTS ::\n", item);
  })

  it("NFTs Created", async() => {
    fetchItemsCreated = await market.fetchItemsCreated();
    
    fetchItemsCreated = await Promise.all(fetchItemsCreated.map(async i  => {
      tokenUri = await nft.tokenURI(i.tokenId);
      item = {
        price:i.price.toString(),
        tokenId:i.tokenId.toString(),
        seller:i.seller,
        owner:i.owner,
        tokenUri
      }
      return item;
    }));
    console.log(":: NFTs CREATED ::\n", item);
  })

});