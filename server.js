/**
 *  这是一个node服务器，没有后台，可以完美运行，只需要把秘钥都生成，api key添加 即可启动
 *  问题：订单信息没有做合并
 *  玩法比较单一
 * ****/
const cron = require("node-cron");
const express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
const TronWeb = require("tronweb");
const redis = require("redis");
const abi = require("simpleabi");
require("dotenv").config();
var request = require("request");
var fs = require("fs")
const HttpProvider = TronWeb.providers.HttpProvider;
const fullNode = new HttpProvider(process.env.FULLNODE);
const solidityNode = new HttpProvider(process.env.SOLIDITYNODE);
const toAddress_trx = process.env.TOADDRESS;//Trx接收地址
const contractAddress_usdt = process.env.CONTRACT_USDT;//USDT TRC20 网络 合约地址
const toAddress_usdt = process.env.TOADDRESS;//Trx的 Usdt 合约 接收地址
const trxValue = Number(process.env.TRXVALUE);//发送的trx值，小数点后面6位，trxValue=1=0.000001trx,用户输入提币1trx则trxvalue为1000000
const tronWeb = new TronWeb(fullNode,solidityNode,process.env.EVENTSERVER,process.env.PRIVATEKEY);

app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


var redisClient = redis.createClient(6379,process.env.RedisHost);
// Check if redis is running
var redisIsReady = false;
var inputRes = null;
var zly = 0;//总盈利
var taskID = 0;

var apiKeyList = [
    process.env.APIKEY1,
    process.env.APIKEY2,
    process.env.APIKEY3,
];
var kindex = 0;
var apikey = apiKeyList[0];
function changeKey(){
    apikey = apiKeyList[kindex];
    kindex ++;
    if(kindex >= apiKeyList.lenght){
        kindex = 0;
    }
    apiKeyList[kindex];
}

fs.writeFile("log_all.log", '==============> \n', {flag: "a"},function (err){
    if (!err) {
        console.log("日志服务2启动成功")
    }
})
fs.writeFile("log_all.log", '开始扫快 \n', {flag: "a"},function (err){});
//获得游戏结果
var getOrder = (currblockID,betAmount)=>{
    var result = currblockID.toString();
    let lastCount = null;//最靠近后面的一个数
    for (let u = 1; u < 7; u++) {
        let endResult = result.substring(result.length - u, result.length);
        if (!isNaN(endResult)) {
            lastCount = Number(endResult);
            break;
        }
    }

    let betNumber = (betAmount / 1000000).toString();
    // if(betNumber >= 100){//trx 不低于100
    let bet;
    if (betNumber.indexOf('.') != -1) {
        bet = betNumber.split('.')[0].toString()
    } else {
        bet = betNumber.toString()
    }
    //转账额度 - 个位数值
    var betEndNum = Number(bet.substring(bet.length - 1, bet.length));

    var amount = 0;
    var magnification = 2.1;//玩法1：赔率  大小单双
    if (lastCount == 0 || lastCount == 5) {
        //小 < 5 , 大 > 5,单 endNum%2 == 1 ， 双 endNum%2 == 0
        if ((betEndNum < 5 || betEndNum % 2 == 1) && lastCount == 0) {// 开奖结果0，投注 小 或者 双 ，返还本金
            amount = betAmount;//返还本金
            fs.writeFile("log.log", ">>返还本金   开奖结果 0 ，下注 " + betEndNum + " 庄家 " + lastCount + ' \n', {flag: "a"}, function (err) {
            });
            console.log(">>返还本金   开奖结果 0 ，下注 " + betEndNum + " 庄家 " + lastCount);
        } else if ((betEndNum > 5 && betEndNum % 2 == 1) && lastCount == 5) {// 开奖结果5，投注 大 或者 单 ，返还本金
            amount = betAmount;//返还本金
            console.log(">>返还本金   开奖结果 5 ，下注 " + betEndNum + " 庄家 " + lastCount);
            fs.writeFile("log.log", ">>返还本金   开奖结果 5 ，下注 " + betEndNum + " 庄家 " + lastCount + ' \n', {flag: "a"}, function (err) {
            });
        } else {
            console.log(">> 1 不中奖 ！下注 " + betEndNum + " 庄家 " + lastCount)
            fs.writeFile("log.log", ">> 1 不中奖 ！下注 " + betEndNum + " 庄家 " + lastCount + ' \n', {flag: "a"}, function (err) {
            });
        }
    } else {
        if (lastCount < 5 && betEndNum < 5) {//小
            amount = betAmount * magnification;
            console.log(">>中奖 小  ，下注 " + betEndNum + " 庄家 " + lastCount);
            fs.writeFile("log.log", ">>中奖 小  ，下注 " + betEndNum + " 庄家 " + lastCount + ' \n', {flag: "a"}, function (err) {
            });
        } else if (lastCount > 5 && betEndNum > 5) {//大
            amount = betAmount * magnification;
            console.log(">>中奖 大  ，下注 " + betEndNum + " 庄家 " + lastCount);
            fs.writeFile("log.log", ">>中奖 大  ，下注 " + betEndNum + " 庄家 " + lastCount + ' \n', {flag: "a"}, function (err) {
            });
        } else if (lastCount % 2 == 1 && betEndNum % 2 == 1) {//单
            amount = betAmount * magnification;
            console.log(">>中奖 单  ，下注 " + betEndNum + " 庄家 " + lastCount);
            fs.writeFile("log.log", ">>中奖 单  ，下注 " + betEndNum + " 庄家 " + lastCount + ' \n', {flag: "a"}, function (err) {
            });
        } else if (lastCount % 2 == 0 && betEndNum % 2 == 0) {//双
            amount = betAmount * magnification;
            console.log(">>中奖 双  ，下注 " + betEndNum + " 庄家 " + lastCount);
            fs.writeFile("log.log", ">>中奖 双  ，下注 " + betEndNum + " 庄家 " + lastCount + ' \n', {flag: "a"}, function (err) {
            });
        } else {
            console.log(">> 2 不中奖 ！下注 " + betEndNum + " 庄家 " + lastCount)
            fs.writeFile("log.log", ">> 2 不中奖 ！下注 " + betEndNum + " 庄家 " + lastCount + ' \n', {flag: "a"}, function (err) {
            });
        }
    }
    return amount;
}
//USDT 转账
async function transfer(contracts,accounts,amount) {
    const {
        abi2
    } = await tronWeb.trx.getContract(contracts);
    // console.log(JSON.stringify(abi));

    const contract = tronWeb.contract(abi2.entrys, contracts);

    const balance = await contract.methods.balanceOf(accounts).call();
    console.log("balance:", balance.toString());

    const resp = await contract.methods.transfer(accounts, amount).send();
    console.log("transfer:", resp);
}
var sweepBolk = ()=>{
    var getNowBlockInfo = { method: 'GET',
        url: process.env.GETNOWBLOCK,
        headers: {
            'TRON-PRO-API-KEY': apikey,
            'Content-Type': 'application/json'
        },
        json: true
    };
    request(getNowBlockInfo, function (error, response, res1) {

        if (error){
            if(error.error != null){
                changeKey();
                return;
            }
            redisClient.set(res1.block_header.raw_data.number+"_res1",500);
            if(inputRes){
                inputRes.write("GetNowBlock error  >> "+JSON.stringify(error,null,"\t")+"</br>");
            }else{
                console.log("getNowBlockInfo error ",error)
            }
            return;
        }
        redisClient.get(res1.block_header.raw_data.number+"_res1",(err,value)=>{
            if(err != null){
                clearInterval(taskID);
                if(inputRes){
                    inputRes.write("redis error  >> "+JSON.stringify(err,null,"\t")+"</br>");
                }
                console.log("redis server error ",err)
                return;
            }
            //数据未处理的
            if(value == null){
                redisClient.set(res1.block_header.raw_data.number+"_res1",JSON.stringify(res1,null,"\t"));
                // console.log("=========getNowBlockInfo========= blockID ",res1.block_header.raw_data.number);
                var getBlockDetails = { method: 'POST',
                    url: process.env.GETBLOCKBYNUM,
                    headers: {
                        'TRON-PRO-API-KEY': apikey,
                        'Content-Type': 'application/json'
                    },
                    body: {
                        num: res1.block_header.raw_data.number
                    },
                    json: true
                };
                // res.write(JSON.stringify(body)+" </br>" );
                redisClient.get(res1.block_header.raw_data.number+"_res2",(err2,value2)=>{
                    if(value2 == null) {
                        request(getBlockDetails, function (error, response, res2) {
                            if (error) {
                                if(error.error != null){
                                    changeKey();
                                    return;
                                }
                                redisClient.set(res1.block_header.raw_data.number + "_res2", 500);
                                if (inputRes) {
                                    inputRes.write("getBlockDetails error  >> " + JSON.stringify(error, null, "\t") + "</br>");
                                } else {
                                    console.log("getBlockDetails error ", error)
                                }
                                return;
                            }
                            // fs.writeFile("sweepBlock.log", "========================== BlockID:"+res1.block_header.raw_data.number+" =========================="+' \n', {flag: "a"},function (err){})
                            // fs.writeFile("sweepBlock.log", ' \n', {flag: "a"},function (err){})
                            // fs.writeFile("sweepBlock.log", JSON.stringify(res1)+' \n', {flag: "a"},function (err){})
                            // fs.writeFile("sweepBlock.log", ' \n', {flag: "a"},function (err){})
                            // fs.writeFile("sweepBlock.log", '========================= end =========================== \n', {flag: "a"},function (err){})
                            //处理交易信息
                            if (res2.transactions != null) {
                                let ydz = tronWeb.address.toHex(toAddress_usdt);
                                let subpath = ydz.substring(2,ydz.length);
                                let owner_processed = [];//同区块下，不管有多少条记录都，只参与一次游戏
                                let transactions_tmp = res2.transactions;
                                let transactions = [];
                                let transactionsK = [];
                                let transactionsOwner_address = [];
                                //订单合并，把同个区块下的打款地址相同的 订单 金额提出出来 做 金额相加 合并为1个订单
                                for (let i = 0; i< transactions_tmp.length; i++) {
                                    let txID = null;
                                    for (let k = 0; k < transactions_tmp[i].raw_data.contract.length; k++) {
                                        let parameter = transactions_tmp[i].raw_data.contract[k].parameter;
                                        let owner_base58_Trx = parameter.value.to_address != null ? tronWeb.address.fromHex(parameter.value.owner_address) : "null";

                                        let isUsdt =  parameter.value.data != null ?  parameter.value.contract_address != null && contractAddress_usdt == tronWeb.address.fromHex(parameter.value.contract_address) && parameter.value.data.indexOf(subpath) != -1 : false;
                                        let isTrx = parameter.value.to_address != null && toAddress_trx == tronWeb.address.fromHex(parameter.value.to_address);
                                        if(isUsdt && transactions_tmp[i].ret[0].contractRet == "SUCCESS"){//区块已经确认都情况下 才使用
                                            txID = transactions_tmp[i].txID;
                                        }
                                        if (isTrx && transactions_tmp[i].ret[0].contractRet == "SUCCESS") {//区块已经确认都情况下 才使用
                                            txID = transactions_tmp[i].txID;
                                        }
                                    }
                                    //只处理自己有关的
                                    if (txID != null) {
                                        //合并订单逻辑，暂无
                                        // for (let i = 0; i < transactions.length; i++) {
                                        //
                                        //     let parameter3 = transactions[i].raw_data.contract[k].parameter;
                                        //     let owner_base58_Trx3 = parameter3.value.to_address != null ? tronWeb.address.fromHex(parameter3.value.owner_address) : "null";
                                        //     let owner_base58_USDT3 = parameter3.value.contract_address != null ? tronWeb.address.fromHex(parameter3.value.contract_address) : "null";
                                        //     let isTrx3 = parameter3.value.to_address != null && toAddress_trx == owner_base58_Trx3;
                                        //     let isUsdt3 = parameter3.value.contract_address != null && toAddress_usdt == owner_base58_USDT3;
                                        //
                                        //     for (let k = 0; k < transactions_tmp[i].raw_data.contract.length; k++) {
                                        //         let parameter2 = transactions[i].raw_data.contract[k].parameter;
                                        //         let owner_base58_Trx2 = parameter2.value.to_address != null ? tronWeb.address.fromHex(parameter2.value.owner_address) : "null";
                                        //         let owner_base58_USDT2 = parameter.value.contract_address != null ? tronWeb.address.fromHex(parameter2.value.contract_address) : "null";
                                        //         let isTrx2 = parameter2.value.to_address != null && toAddress_trx == owner_base58_Trx2;
                                        //         let isUsdt2 = parameter2.value.contract_address != null && toAddress_usdt == owner_base58_USDT2;
                                        //         if (transactions[i].txID != txID && ){
                                        //
                                        //             if(isTrx2){
                                        //                 let amountTRX = parameter2.value.amount;
                                        //             }
                                        //             if(isUsdt2){
                                        //                 let list = abi.decodeValues(parameter2.value.data);
                                        //                 let amountUSDT = list[list.length -1];
                                        //             }
                                        //         }
                                        //     }
                                        // }
                                        transactions.push(transactions_tmp[i]);
                                        fs.writeFile("log_all.log", '================res1=============== \n', {flag: "a"}, function (err) {
                                        })
                                        fs.writeFile("log_all.log", JSON.stringify(res1, null, "\t") + ' \n', {flag: "a"}, function (err) {
                                        })
                                        fs.writeFile("log_all.log", '================res2=============== \n', {flag: "a"}, function (err) {
                                        })
                                        fs.writeFile("log_all.log", JSON.stringify(res2, null, "\t") + ' \n', {flag: "a"}, function (err) {
                                        })
                                        fs.writeFile("log_all.log", '================end=============== \n', {flag: "a"}, function (err) {
                                        })
                                    }
                                }

                                if(transactions.length > 0){
                                    console.log("====4=====getNowBlockInfo========= blockID ",res1.block_header.raw_data.number);
                                    console.log("> 交易列表  transactions.length ",transactions.length)
                                    redisClient.set(res1.block_header.raw_data.number + "_res2", JSON.stringify(res2,null,"\t"));
                                    for (let i = 0; i < transactions.length; i++) {
                                        for (let k = 0; k < transactions[i].raw_data.contract.length; k++) {
                                            let parameter = transactions[i].raw_data.contract[k].parameter;
                                            let owner_base58_Trx = parameter.value.owner_address != null ? tronWeb.address.fromHex(parameter.value.owner_address) : "null";
                                            let owner_base58_USDT = parameter.value.contract_address != null ? tronWeb.address.fromHex(parameter.value.contract_address) : "null";
                                            let isTrx = parameter.value.to_address != null && toAddress_trx == tronWeb.address.fromHex(parameter.value.to_address);
                                            let isUsdt =  parameter.value.data != null ?  parameter.value.contract_address != null && contractAddress_usdt == tronWeb.address.fromHex(parameter.value.contract_address) && parameter.value.data.indexOf(subpath) != -1 : false;
                                            if(owner_processed.indexOf(owner_base58_USDT) == -1){
                                                console.log("====5=====getNowBlockInfo========= blockID ",res1.block_header.raw_data.number);
                                            }
                                              if(isUsdt){
                                                  console.log("====6.200=====getNowBlockInfo========= blockID ",res1.block_header.raw_data.number);
                                              }

                                            if (owner_processed.indexOf(owner_base58_USDT) == -1 && isUsdt) {
                                                fs.writeFile("log.log", 'Usdt订单 \n', {flag: "a"}, function (err) {});
                                                console.log("=====================来Usdt订单了===================== blockID " + res1.block_header.raw_data.number);
                                                fs.writeFile("log.log", '----------------------------getNowBlockInfo------------------------------------- \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", JSON.stringify(res1, null, "\t") + ' \n', {flag: "a"}, function (err) {})
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", '---------------------getBlockDetails------------------------------------------- \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", JSON.stringify(res2, null, "\t") + ' \n', {flag: "a"}, function (err) {})
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", '-----------------------------next------------------------------------ \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                owner_processed.push(tronWeb.address.fromHex(parameter.value.owner_address));
                                                try{
                                                    let list = abi.decodeValues(parameter.value.data);
                                                    let amountUSDT = list[list.length -1];
                                                    var yl = amountUSDT;
                                                    var amount = getOrder(res1.blockID,amountUSDT);//获取输赢结果
                                                    if (amount > 0) {
                                                        yl = (amountUSDT - amount);
                                                        zly += yl;
                                                        fs.writeFile("transfer_log.log", "赔付 USDT " + amount + ' \n', {flag: "a"}, function (err) {
                                                        });

                                                        transfer(process.env.CONTRACT_USDT,owner_base58_Trx,amount).then(() => {console.log("ok");}).catch((err) => {console.log("error:", err);});

                                                        console.log("区块高度 " + res1.block_header.raw_data.number + " 发起 >> USDT 转账 ", amount, " to ", owner_base58_Trx, " , transaction info:  ", transaction);
                                                        if (inputRes) inputRes.write("区块高度 " + res1.block_header.raw_data.number + " 发起 >> 转账 " + amount + " to " + owner_base58_Trx + " + transaction info:  " + transaction + " </br>");
                                                    } else {
                                                        console.log(">> 未发起转账 ！ " + res1.block_header.raw_data.number)
                                                        zly += amountUSDT;
                                                    }
                                                    console.log(">>> 盈利 ", yl / 1000000, " 总毛利 " + zly / 1000000);

                                                }catch(err){
                                                    console.log("getOrder usdt error ",err);
                                                    fs.writeFile("log.log", "getOrder usdt error" + JSON.stringify(err, null, "\\t") +' \n', {flag: "a"}, function (err) {});
                                                }
                                            }
                                            if (owner_processed.indexOf(owner_base58_Trx) == -1 && isTrx) {
                                                fs.writeFile("log.log", 'Trx订单 \n', {flag: "a"}, function (err) {});
                                                console.log("=====================来Trx订单了===================== blockID " + res1.block_header.raw_data.number);
                                                fs.writeFile("log.log", '----------------------------getNowBlockInfo------------------------------------- \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", JSON.stringify(res1, null, "\t") + ' \n', {flag: "a"}, function (err) {})
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {
                                                });
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", '---------------------getBlockDetails------------------------------------------- \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", JSON.stringify(res2, null, "\t") + ' \n', {flag: "a"}, function (err) {})
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", '-----------------------------next------------------------------------ \n', {flag: "a"}, function (err) {});
                                                fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                owner_processed.push(owner_base58_Trx);
                                                var to_base58 = tronWeb.address.fromHex(parameter.value.to_address);


                                                fs.writeFile("log.log", "============start========================================" + ' \n', {flag: "a"}, function (err) {
                                                });
                                                fs.writeFile("log.log", "数量 sun amount : " + parameter.value.amount + ' \n', {flag: "a"}, function (err) {
                                                });
                                                fs.writeFile("log.log", "数量 TRX amount : " + parameter.value.amount / 1000000 + ' \n', {flag: "a"}, function (err) {
                                                });
                                                fs.writeFile("log.log", "" + ' \n', {flag: "a"}, function (err) {
                                                });
                                                fs.writeFile("log.log", "" + ' \n', {flag: "a"}, function (err) {
                                                });

                                                //官方固定比例:  1 TRX = 1000000 sun
                                                console.log("数量 sun amount : ", parameter.value.amount);
                                                console.log("数量 TRX amount : ", parameter.value.amount / 1000000);

                                                // console.log("交易数据 "+ i,transactions[i]);
                                                // console.log("raw_data 数据 "+ i,transactions[i].raw_data);
                                                console.log("交易类型 type.googleapis.com/protocol.TransferContract TRX ");
                                                console.log("交易类型 type.googleapis.com/protocol.TriggerSmartContract USDT ");
                                                console.log("交易类型 : ", parameter.type_url);
                                                fs.writeFile("log.log", "交易类型 " + parameter.type_url + ' \n', {flag: "a"}, function (err) {
                                                });
                                                console.log("owner_ox16 地址 ", parameter.value.owner_address);
                                                fs.writeFile("log.log", "owner_ox16 地址 " + parameter.value.owner_address + ' \n', {flag: "a"}, function (err) {
                                                });
                                                console.log("owner_base58_Trx 地址 ", owner_base58_Trx);
                                                fs.writeFile("log.log", "owner_base58_Trx 地址 " + owner_base58_Trx + ' \n', {flag: "a"}, function (err) {
                                                });
                                                console.log("to_ox16 地址 ", parameter.value.to_address);
                                                console.log("to_base58 地址 ", to_base58);
                                                // console.log("raw_data 数据 "+ i,transactions[i].raw_data);
                                                // console.warn("====================================================");
                                                // console.log("contract 数据 "+ k,transactions[i].raw_data.contract[k]);
                                                console.warn("====================================================");
                                                // for(var j=0;j<transactions[i].ret.length;j++){
                                                //     console.log("ret 数据 "+ j,transactions[i].ret[j]);
                                                // }
                                                console.warn("====================================================");
                                                // console.warn("=== res1 ",res1);
                                                // console.warn("====================================================");
                                                // console.warn("============or========================================");
                                                console.warn("====================================================");
                                                // console.warn("=== res2 ",res2);
                                                // console.warn("====================================================");
                                                // console.warn("====================================================");
                                                console.warn("==============end======================================");
                                                try{
                                                    var yl = parameter.value.amount;
                                                    var amount = getOrder(res1.blockID,parameter.value.amount);//获取输赢结果
                                                    if (amount > 0) {
                                                        yl = (parameter.value.amount - amount);
                                                        zly += yl;
                                                        fs.writeFile("transfer_log.log", "赔付 TRX " + amount + ' \n', {flag: "a"}, function (err) {
                                                        });
                                                        var transaction = tronWeb.trx.sendTransaction(owner_base58_Trx, amount); //转账地址  数量
                                                        console.log("区块高度 " + res1.block_header.raw_data.number + " 发起 >> TRX 转账 ", amount, " to ", owner_base58_Trx, " , transaction info:  ", transaction);
                                                        if (inputRes) inputRes.write("区块高度 " + res1.block_header.raw_data.number + " 发起 >> 转账 " + amount + " to " + owner_base58_Trx + " + transaction info:  " + transaction + " </br>");
                                                    } else {
                                                        console.log(">> 未发起转账 ！ " + res1.block_header.raw_data.number)
                                                        zly += parameter.value.amount;
                                                    }
                                                    console.log(">>> 盈利 ", yl / 1000000, " 总毛利 " + zly / 1000000);
                                                    fs.writeFile("log.log", ">>> 盈利 " + (yl / 1000000) + " 总毛利 " + (zly / 1000000) + ' \n', {flag: "a"}, function (err) {});
                                                    fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                    fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                    fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                    fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                    fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                    fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                    fs.writeFile("log.log", ' \n', {flag: "a"}, function (err) {});
                                                }catch(err){
                                                    console.log("getOrder trx error ",err);
                                                    fs.writeFile("log.log", "getOrder trx error" + JSON.stringify(err, null, "\\t") +' \n', {flag: "a"}, function (err) {});
                                                }


                                                // }else{
                                                //     console.log("====订单 低于100 ")
                                                // }
                                            }
                                        }
                                    }
                                }
                            } else {
                                redisClient.set(res1.block_header.raw_data.number + "_res2", 200);
                            }
                        });
                    }
                });
            }
        });
    });
}

redisClient.on('error', function(err) {
    redisIsReady = false;
    console.log('redis is not running');
    console.log(err);
});
redisClient.on('ready', function() {

    fs.writeFile("log.log", 'Redis 启动 \n', {flag: "a"},function (err){
        if (!err) {
            console.log("日志服务启动成功")
        }
    })

    redisIsReady = true;
    console.log('redis is running');

    // fs.writeFile()
    //     path: 要操作文件路径
    //     data: 要写入的数据
    //     options  选项，可以对吸入进行一些设置
    //     callback 当写入完成以后执行的函数
    fs.writeFile("log.log", '开始扫快 \n', {flag: "a"},function (err){})
    clearInterval(taskID);
    //启动
    taskID = setInterval(async () => {await sweepBolk()}, 1000);
});

// app.get('/', (req, res) => {
//     // try{
//         // res.setHeader('Content-type', 'application/octet-stream');
//         res.setHeader('Content-type', 'text/html; charset=utf-8');
//         if(!redisIsReady){
//             res.write("服务器暂未启动 >>  </br>");
//             res.end();
//         }
//         res.write("欢迎来到非常简单的后台>>  </br>");
//         res.write("init Game >>  </br>");
//         res.write("网络 fullNode >> "+process.env.FULLNODE+" </br>");
//         res.write("网络 solidityNode >> "+process.env.SOLIDITYNODE+" </br>");
//         res.write("网络 eventServer >> "+process.env.EVENTSERVER+" </br>");
//         res.write("私钥 privateKey >> ********** </br>");
//         res.write("RedisHost >> "+process.env.RedisHost+" </br>");
//         res.write("init redis >> "+ redisIsReady +" </br>" );
//         inputRes = res;
//         if(inputRes)inputRes.write("init 扫块 开始>>  </br>" );
//     res.write("监听Trc20 Trx 的收款地址 >> "+toAddress_trx+" </br>");
//     res.write("监听Trc20 Usdt 的收款地址 >> "+toAddress_usdt+" </br>");
// });
// app.get('/creat', (req, res) => {
//         res.setHeader('Content-type', 'text/html; charset=utf-8');
//         var account = TronWeb.createAccount();
//         account.then(function (account) {
//             console.log('- account:', account);
//             console.log('- Private Key:', account.privateKey);
//             console.log('- Base58:', account.address.base58);
//             res.write("创建了一个新的钱包地址 密钥 对 acount : </br>");
//             res.write(JSON.stringify(account,null,"\t")+"  </br>");
//             // res.write( 'result privateKey:'+account.privateKey- '- address :'+ account.address.base58+"</br>");
//             res.end();
//         });
//
// });


// var server = app.listen(881, async () => {
//     var host = server.address().address;
//     var port = server.address().port;
//     try {
//         await console.log("应用实例，访问地址为 http://%s:%s", host, port);
//     } catch (error) {
//         console.log("ERROR IN TRON WEB ::::: ----  3", error);
//     }
//
// })
// server.timeout = 12000000;
