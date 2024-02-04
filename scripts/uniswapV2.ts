import { ethers } from 'ethers';
import { program, Option } from 'commander';
import * as dotenv from 'dotenv';
dotenv.config();
import _tokens from '../data/tokens.json'
import { abi as IUniswapV2FactoryABI } from '@uniswap/v2-core/build/IUniswapV2Factory.json'
import { abi as IUniswapV2PairABI } from '@uniswap/v2-core/build/IUniswapV2Pair.json'

const chainId = 1;
const FACTORY_ADDRESS = '0x00000000000000000000000000000000000' //UniswapV2Factoryのコントラクトアドレス
const tokens: TokenData[] = _tokens;

interface TokenData {
    chainId: number
    symbol: string
    address: string
    decimals: number
}

async function main(tokenSymbolA: string, tokenSymbolB: string) {
    const rpcURL: string = process.env.ETHEREUM_URL ?? "";
    if(rpcURL === ""){
        throw new Error('ETHEREUM_URL not set');
    }
    const tokenA: TokenData = tokens.filter((d: TokenData) => (d.chainId === chainId) && (d.symbol == tokenSymbolA))[0]
    const tokenB: TokenData = tokens.filter((d: TokenData) => (d.chainId === chainId) && (d.symbol == tokenSymbolB))[0]
    const [token0, token1] = tokenA.address < tokenB.address ? [tokenA, tokenB] : [tokenB, tokenA]

    const provider = new ethers.providers.JsonRpcProvider(rpcURL);
    const factory = new ethers.Contract(FACTORY_ADDRESS, IUniswapV2FactoryABI, provider);
    const pairAddress = await factory.getPair(token0.address, token1.address);
    console.log(`${token0.symbol}-${token1.symbol} Pair Pool Address: ${pairAddress}`);
    const pairContract = new ethers.Contract(pairAddress, IUniswapV2PairABI, provider);

    const [reserve0, reserve1, blockTimestampLast] = await pairContract.getReserves(); 
    /**
     * tokenA,Bをtoken0,1に大小でソートした恩恵は↑恐らくここで受ける。一見reserve0,1のどっちがtokenAのか分からない。
     * しかし、仮にpoolコントラクト側でもtokenペアを大小をソートしてその順番でreserveに入れているとしたら、上記の問題は解決する。
     * 各コントラクトで同じようにソートして統一していれば、コントラクト間でのやり取りでどっちがどっちだってならない。
     * 読んでる途中どっちがどっちだっけってならずに済む。
     * シンボルを変数で包むとどっちがどっちだってなる　＝＞　大小でソートして変数にも数字で大小付ければ見やすい
    */

    /**
     * BigIntはJavascriptのもの。9,007,199,254,740,991(253 – 1)より大きい値を扱う時に使用する。
     * BigNumberはethersのもの。小数が切り取られた整数。
     * 多分,,,。
     */
    console.log(reserve0);
    console.log(typeof reserve0);
    const denominator = BigInt(reserve0) * (10n ** BigInt(token1.decimals)); //(※1)
    const numerator = BigInt(reserve1) * (10n ** BigInt(token0.decimals)); //(※2)
    const precision = 15;
    const price = Number(10n ** BigInt(precision) * numerator / denominator) / (10 ** precision);
    console.log(`1 ${token0.symbol} = ${price} ${token1.symbol}`)
    console.log(`1 ${token1.symbol} = ${1 / price} ${token0.symbol}`)
    /**
     * (※1)分子のreserve1の値をsolidity用の桁が多いものから人用の値にするためにdecimalsの分だけ10で割ってるだけ。
     * (※2)分母のreserve0の値をsolidity用の桁が多いものから人用の値にするためにdecimalsの分だけ10で割ってるだけ。
     */

    //上のやつの型実験。内容も結果も同じ。
    // console.log(reserve0);
    // console.log(typeof reserve0);
    // const denominator_ = BigInt(reserve0) * (10n ** BigInt(token1.decimals));
    // const numerator_ = BigInt(reserve1) * (10n ** BigInt(token0.decimals));
    // const denominator = Number(denominator_);
    // const numerator = Number(numerator_);
    // const price = numerator / denominator;
    // console.log(`1 ${token0.symbol} = ${price} ${token1.symbol}`)
    // console.log(`1 ${token1.symbol} = ${1 / price} ${token0.symbol}`)
}

program
    .addOption(new Option('-A, --tokenSymbolA <symbol>', 'symbol of ERC20 token (e.g. WBTC)').makeOptionMandatory())
    .addOption(new Option('-B, --tokenSymbolB <symbol>', 'symbol of ERC20 token (e.g. WRTC)').makeOptionMandatory())
    .parse()
const options = program.opts();

main(options.tokenSymbolA, options.tokenSymbolB).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
