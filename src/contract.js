import { ethers } from 'ethers';
export const ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111);
const INFURA_ID = import.meta.env.VITE_INFURA_PROJECT_ID || '';
const RPC = `https://sepolia.infura.io/v3/${INFURA_ID}`;
export const ABI = [
  'function admin() view returns (address)',
  'function issuers(address) view returns (bool)',
  'function setIssuer(address,bool)',
  'function createCourse(string,string,string)',
  'function getCourses() view returns (tuple(string code,string title,string description,bool exists)[])',
  'function issueCertificate(string,string,address,bytes32)',
  'function getCertificate(string) view returns (tuple(string certificateId,string courseCode,address recipient,bytes32 documentHash,uint64 issuedAt,bool revoked,bool exists))',
  'function verifyCertificate(string,bytes32) view returns (bool valid,bool revoked,bool hashMatches)',
  'function getWalletCertificateIds(address) view returns (string[])',
  'function revokeCertificate(string,string)',
  'function getRevocationInfo(string) view returns (tuple(string reason,address revokedBy,uint64 revokedAt))',
  'event CertificateIssued(bytes32 indexed idHash,string certificateId,address indexed recipient,bytes32 documentHash)',
  'event CertificateRevoked(bytes32 indexed idHash,string certificateId,address indexed revokedBy,string reason,uint64 revokedAt)',
  'event CourseCreated(bytes32 indexed codeHash,string code,string title)',
  'event IssuerUpdated(address indexed issuer,bool allowed)'
];
export function readContract() {
  if (!ethers.isAddress(ADDRESS) || !INFURA_ID || INFURA_ID === 'YOUR_INFURA_PROJECT_ID') throw Error('กรุณาตั้งค่า VITE_CONTRACT_ADDRESS และ VITE_INFURA_PROJECT_ID ในไฟล์ .env');
  return new ethers.Contract(ADDRESS, ABI, new ethers.JsonRpcProvider(RPC, CHAIN_ID));
}
export async function connectWallet() {
  if (!window.ethereum) throw Error('ไม่พบ MetaMask กรุณาติดตั้งส่วนขยายก่อน');
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send('eth_requestAccounts', []);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) throw Error(`กรุณาเปลี่ยนเครือข่าย MetaMask เป็น Sepolia (Chain ID ${CHAIN_ID})`);
  return { signer: await provider.getSigner(), provider };
}
export async function writeContract() {
  if (!ethers.isAddress(ADDRESS)) throw Error('ยังไม่ได้ตั้งค่า Contract Address');
  const { signer } = await connectWallet();
  return new ethers.Contract(ADDRESS, ABI, signer);
}
export async function sha256File(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return '0x' + [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const shortAddress = (s) => s ? `${s.slice(0, 6)}...${s.slice(-4)}` : '';
export function errorMessage(error) { return error?.shortMessage || error?.reason || error?.message || 'เกิดข้อผิดพลาด'; }

export const EXPLORER = CHAIN_ID === 11155111 ? 'https://sepolia.etherscan.io' : 'https://etherscan.io';
export const DEPLOYMENT_BLOCK = Number(import.meta.env.VITE_DEPLOYMENT_BLOCK || 0);
// Query in bounded ranges to avoid RPC block-range limits; set deployment block to speed up.
export async function loadHistory(onProgress) {
  const contract = readContract();
  const provider = contract.runner;
  const latest = await provider.getBlockNumber();
  const from = Math.max(0, DEPLOYMENT_BLOCK || latest - 45000);
  const step = 2000;
  const iface = contract.interface;
  const topics = ['CertificateIssued', 'CertificateRevoked', 'CourseCreated', 'IssuerUpdated']
    .map(name => iface.getEvent(name).topicHash);
  const entries = [];
  for (let start = from; start <= latest; start += step) {
    const end = Math.min(latest, start + step - 1);
    const logs = await provider.getLogs({address: ADDRESS, fromBlock: start, toBlock: end, topics: [topics]});
    for (const log of logs) {
      try {
        const parsed = iface.parseLog(log);
        entries.push({ name: parsed.name, args: parsed.args, hash: log.transactionHash, block: log.blockNumber, index: log.index });
      } catch { /* ignore unknown logs */ }
    }
    if (onProgress) onProgress({end, latest, count: entries.length});
  }
  return entries.sort((a,b) => b.block-a.block || b.index-a.index);
}
