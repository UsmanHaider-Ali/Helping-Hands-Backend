var web3 = require("../provider.js");
var solc = require("solc");
const { exec } = require("child_process");

var fs = require("fs");

var campaignContractFile = fs.readFileSync("contracts/Campaign.sol").toString();

var contractInput = {
  language: "Solidity",
  sources: {
    "contracts/Campaign.sol": {
      content: campaignContractFile,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["*"],
      },
    },
  },
};

var contractOutput = JSON.parse(solc.compile(JSON.stringify(contractInput)));

function runTruffleMigrate() {
  return new Promise((resolve, reject) => {
    const migrateProcess = exec("truffle migrate");

    migrateProcess.stdout.on("data", (data) => {
      console.log(data);
    });
    migrateProcess.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error("Truffle migration failed."));
      }
    });
  });
}

exports.deployContract = async (req, res, next) => {
  const { creatorAddress } = req.body;

  var contractAbi =
    contractOutput.contracts["contracts/Campaign.sol"]["Campaign"].abi;
  var contractByteCode =
    contractOutput.contracts["contracts/Campaign.sol"]["Campaign"].evm.bytecode
      .object;

  var campaignContract = new web3.eth.Contract(contractAbi);

  await campaignContract
    .deploy({
      data: contractByteCode,
      arguments: [],
    })
    .send({ from: creatorAddress, gas: 3610857 })
    .on("receipt", (contractReceipt) => {
      fs.writeFileSync(
        "build/addresses/campaign-contract-address.json",
        JSON.stringify({ address: contractReceipt.contractAddress }, null, 2)
      );

      res.json({
        message: "Contract deployed successfully.",
        success: true,
        result: contractReceipt,
      });
      return;
    });
};

const getCampaignContract = async () => {
  const contractAddress = JSON.parse(
    fs.readFileSync("build/addresses/campaign-contract-address.json")
  );

  var contractAbi =
    contractOutput.contracts["contracts/Campaign.sol"]["Campaign"].abi;

  return new web3.eth.Contract(contractAbi, contractAddress.address);
};

exports.createCampaign = async (req, res, next) => {
  var imageUrl = "";

  if (req.file === undefined) {
    imageUrl = "_";
  } else {
    imageUrl = req.file.path;
  }

  const {
    userId,
    title,
    description,
    categoryId,
    startTimestamp,
    deadline,
    targetFunds,
    creator,
  } = req.body;

  var contract = await getCampaignContract();

  await contract.methods
    .createCampaign(
      userId,
      categoryId,
      title,
      description,
      targetFunds,
      startTimestamp,
      deadline,
      imageUrl
    )
    .send({ from: creator, gas: 6450770 }, (error, transaction) => {
      if (error) {
        res.json({
          message: "Error while creating campaign.",
          success: false,
          error,
        });
        return;
      }

      res.json({
        message: "Campaign created successfully.",
        success: true,
        result: transaction,
      });
      return;
    });
};

exports.donateFunds = async (req, res, next) => {
  const { userAddress, amount, campaignId, userId } = req.body;

  try {
    const contract = await getCampaignContract();
    res.json({
      message: "Funds donated successfully.",
      success: true,
      result: await contract.methods.donateFunds(campaignId, userId).send({
        from: userAddress,
        value: amount,
        gas: 470495,
      }),
    });
    return;
  } catch (err) {
    res.json({
      message: "" + err,
      success: false,
    });
    return;
  }
};

exports.withdrawFunds = async (req, res, next) => {
  const { ownerAddress, campaignId, userId } = req.body;

  try {
    const contract = await getCampaignContract();

    const result = await contract.methods
      .withdrawFunds(ownerAddress, campaignId, userId)
      .send({
        from: ownerAddress,
        gas: 268363,
      });

    res.json({
      message: "Funds withdraw successfully.",
      success: true,
      result: result,
    });
    return;
  } catch (err) {
    res.json({
      success: false,
      message: "" + err,
    });
    return;
  }
};

exports.getCampaign = async (req, res, next) => {
  const { campaignId } = req.body;

  try {
    // await runTruffleMigrate();

    const contract = await getCampaignContract();
    let result = await contract.methods.getCampaign(campaignId).call();

    let rawStatus = result[12];

    var status = "";

    if (rawStatus == 0) {
      status = "Scheduled";
    } else if (rawStatus == 1) {
      status = "Ongoing";
    } else if (rawStatus == 2) {
      status = "Completed";
    }

    let campaign = {
      creator: result[0],
      userId: result[1],
      categoryId: result[2],
      campaignId: result[3],
      title: result[4],
      description: result[5],
      targetFunds: result[6],
      startTime: result[7],
      deadline: result[8],
      raisedFunds: result[9],
      remainingFunds: result[10],
      imageUrl: result[11],
      status: status,
    };

    res.json({
      message: "Campaign fetched successfully.",
      success: true,
      campaign: campaign,
    });
    return;
  } catch (err) {
    res.json({
      success: false,
      message: `${err}`,
    });
    return;
  }
};

exports.getCampaigns = async (req, res, next) => {
  const { userId, categoryId } = req.body;
  try {
    // await runTruffleMigrate();

    const contract = await getCampaignContract();

    var result = await contract.methods.getAllCampaigns().call();

    let campaigns = [];

    for (let i = 0; i < result.length; i++) {
      let rawStatus = result[i][12];

      var status = "";

      if (rawStatus == 0) {
        status = "Scheduled";
      } else if (rawStatus == 1) {
        status = "Ongoing";
      } else if (rawStatus == 2) {
        status = "Completed";
      }

      let campaign = {
        creator: result[i][0],
        userId: result[i][1],
        categoryId: result[i][2],
        campaignId: result[i][3],
        title: result[i][4],
        description: result[i][5],
        targetFunds: result[i][6],
        startTime: result[i][7],
        deadline: result[i][8],
        raisedFunds: result[i][9],
        remainingFunds: result[i][10],
        imageUrl: result[i][11],
        status: status,
      };

      if (userId == "" && categoryId == "") campaigns.push(campaign);
      else if (userId == campaign.userId && categoryId == "")
        campaigns.push(campaign);
      else if (userId == "" && categoryId == campaign.categoryId)
        campaigns.push(campaign);
      else if (userId == campaign.userId && categoryId == campaign.categoryId)
        campaigns.push(campaign);
    }

    res.json({
      message: "Campaigns fetched successfully.",
      success: true,
      campaigns: campaigns,
    });
    return;
  } catch (err) {
    res.json({
      success: false,
      error: `${err}`,
    });
    return;
  }
};

exports.getUserStats = async (req, res, next) => {
  const { userId } = req.body;
  try {
    const contract = await getCampaignContract();

    var result = await contract.methods.getUserStats().call();

    let stats = [];

    for (let i = 0; i < result.length; i++) {
      let stat = {
        userId: result[i][0],
        contribution: result[i][2] ? `-${result[i][1]}` : `+${result[i][1]}`,
        isFundsDonating: result[i][2],
        timestamp: result[i][3],
        description: result[i][4],
      };
      if (stat.userId == userId) stats.push(stat);
    }

    let totalIn = 0;
    let totalOut = 0;

    stats.forEach((stat) => {
      const contribution = parseInt(stat.contribution);
      if (contribution > 0) {
        totalIn += contribution;
      } else if (contribution < 0) {
        totalOut += contribution;
      }
    });
    res.json({
      message: "Stats fetched successfully.",
      success: true,
      totalIn: `${totalIn}`,
      totalOut: `${Math.abs(totalOut)}`,
      stats: stats,
    });
    return;
  } catch (err) {
    res.json({
      success: false,
      error: `${err}`,
    });
    return;
  }
};

exports.getCampaignFunders = async (req, res, next) => {
  const campaignId = req.body.campaignId;
  try {
    const contract = await getCampaignContract();

    var result = await contract.methods.getCampaignFunders(campaignId).call();

    let funders = [];

    for (let i = 0; i < result.length; i++) {
      let funder = {
        funder: result[i][0],
        contribution: result[i][1],
        timestamp: result[i][2],
      };
      funders.push(funder);
    }

    res.json({
      message: "Funders fetched successfully.",
      success: true,
      funders: funders,
    });
    return;
  } catch (err) {
    res.json({
      success: false,
      error: `${err}`,
    });
    return;
  }
};
