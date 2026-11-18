import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import {
  LayoutDashboard,
  GraduationCap,
  BadgeCheck,
  ShieldCheck,
  ShieldX,
  Wallet,
  Plus,
  Search,
  FileCheck2,
  Copy,
  ExternalLink,
  Menu,
  X,
  UploadCloud,
  ArrowRight,
  BookOpen,
  Users,
  LockKeyhole,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import {
  ADDRESS,
  CHAIN_ID,
  readContract,
  writeContract,
  connectWallet,
  sha256File,
  shortAddress,
  errorMessage,
  loadHistory,
  EXPLORER,
} from "./contract";

const adminItems = [
  { id: "courses", label: "จัดการหลักสูตร", icon: BookOpen },
  { id: "issue", label: "ออกใบรับรอง", icon: BadgeCheck },
  { id: "revoke", label: "เพิกถอนใบรับรอง", icon: ShieldX },
  { id: "permissions", label: "กำหนดสิทธิ์ผู้ออก", icon: Users },
  { id: "history", label: "ประวัติธุรกรรม", icon: RefreshCw },
];
const userItems = [
  { id: "verify", label: "ตรวจสอบใบรับรอง", icon: ShieldCheck },
  { id: "history", label: "ประวัติธุรกรรม", icon: RefreshCw },
  { id: "mine", label: "ใบรับรองของฉัน", icon: BadgeCheck },
];
const issuerItems = [
  ...userItems,
  { id: "issue", label: "ออกใบรับรอง", icon: BadgeCheck },
];
const allItems = [...adminItems, ...userItems];

const initialIssue = { id: "", course: "", wallet: "" };
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Empty({ title, text }) {
  return (
    <div className="empty">
      <FileCheck2 size={35} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
function Status({ children, type = "info" }) {
  return (
    <div className={`notice ${type}`}>
      {type === "error" ? (
        <AlertTriangle size={18} />
      ) : (
        <CheckCircle2 size={18} />
      )}
      <span>{children}</span>
    </div>
  );
}
function CertificateCard({ cert, onOpen }) {
  return (
    <button className="cert-card" onClick={() => onOpen(cert.certificateId)}>
      <div className="cert-mark">
        <BadgeCheck size={25} />
      </div>
      <div className="cert-main">
        <strong>{cert.certificateId}</strong>
        <span>หลักสูตร {cert.courseCode}</span>
        <small>
          ออกเมื่อ{" "}
          {new Date(Number(cert.issuedAt) * 1000).toLocaleDateString("th-TH")}
        </small>
      </div>
      <span className={`tag ${cert.revoked ? "danger" : "success"}`}>
        {cert.revoked ? "เพิกถอนแล้ว" : "ใช้งานได้"}
      </span>
      <ArrowRight size={17} />
    </button>
  );
}
export default function App() {
  const [page, setPage] = useState(
    new URLSearchParams(location.search).has("cert") ? "verify" : "overview",
  );
  const [mobile, setMobile] = useState(false);
  const [account, setAccount] = useState("");
  const [role, setRole] = useState({ admin: false, issuer: false });
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState(false);
  const [roleReady, setRoleReady] = useState(false);
  const [courses, setCourses] = useState([]);
  const [myCerts, setMyCerts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [verifyId, setVerifyId] = useState(
    new URLSearchParams(location.search).get("cert") || "",
  );
  const [verifyFile, setVerifyFile] = useState(null);
  const [verified, setVerified] = useState(null);
  const [courseForm, setCourseForm] = useState({
    code: "",
    title: "",
    description: "",
  });
  const [issueForm, setIssueForm] = useState(initialIssue);
  const [issueFile, setIssueFile] = useState(null);
  const [revokeId, setRevokeId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeInfo, setRevokeInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyProgress, setHistoryProgress] = useState("");
  const [issuerAddress, setIssuerAddress] = useState("");
  const [issuerAllowed, setIssuerAllowed] = useState(true);
  const configured = ethers.isAddress(ADDRESS);
  const isAdmin = role.admin;
  const isIssuer = role.admin || role.issuer;
  const items = roleError ? userItems.filter((item) => item.id !== "mine") : isAdmin ? adminItems : role.issuer ? issuerItems : account ? userItems : userItems.filter((item) => item.id !== "mine");
  const roleLabel = roleLoading || (account && !roleReady)
    ? "กำลังตรวจสอบสิทธิ์..."
    : roleError ? "ตรวจสอบสิทธิ์ไม่สำเร็จ"
    : isAdmin ? "Admin"
    : role.issuer ? "Issuer"
    : account ? "Student" : "Public";
  const notify = (message, type = "success") => setNotice({ message, type });
  async function refreshCourses() {
    try {
      setCourses(await readContract().getCourses());
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  }
  async function refreshAccount(wallet) {
    setRole({ admin: false, issuer: false });
    setMyCerts([]);
    setRoleError(false);
    setRoleReady(false);
    if (!wallet) {
      setRoleLoading(false);
      setRoleReady(true);
      return;
    }
    setRoleLoading(true);
    try {
      const contract = readContract();
      // Role ต้องตรวจสอบสำเร็จก่อน จึงอนุญาตให้แสดงเมนูที่มีสิทธิ์
      const [adminAddress, issuer] = await Promise.all([
        contract.admin(),
        contract.issuers(wallet),
      ]);
      const admin = adminAddress.toLowerCase() === wallet.toLowerCase();
      setRole({ admin, issuer: Boolean(issuer) });
      setRoleReady(true);
      console.log("Contract Admin:", adminAddress);
      console.log("Connected Wallet:", wallet);
      console.log("Current Role:", admin ? "Admin" : issuer ? "Issuer" : "Student");
    } catch (e) {
      setRoleError(true);
      setRoleReady(true);
      notify("ตรวจสอบสิทธิ์ Wallet ไม่สำเร็จ: " + errorMessage(e), "error");
    } finally {
      setRoleLoading(false);
    }
    // การอ่านใบรับรองแยกออกมา ไม่ให้ความผิดพลาดกระทบการตรวจสอบ Role
    try {
      const contract = readContract();
      const ids = await contract.getWalletCertificateIds(wallet);
      const certs = await Promise.all(ids.map((id) => contract.getCertificate(id)));
      setMyCerts(certs.slice().reverse());
    } catch (e) {
      console.error("Cannot load wallet certificates:", e);
    }
  }
  async function onConnect() {
    try {
      const { signer } = await connectWallet();
      const addr = await signer.getAddress();
      setAccount(addr);
      await refreshAccount(addr);
      notify("เชื่อมต่อ MetaMask สำเร็จ");
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  }
  useEffect(() => {
    if (configured) refreshCourses();
    if (verifyId) setPage("verify");
  }, []);
  useEffect(() => {
    // อ่าน Wallet ที่อนุญาตไว้แล้วโดยไม่เปิดหน้าต่าง MetaMask
    if (!window.ethereum) return;
    const restore = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const [accounts, network] = await Promise.all([
          provider.send("eth_accounts", []), provider.getNetwork(),
        ]);
        if (accounts.length && Number(network.chainId) === CHAIN_ID) {
          setAccount(accounts[0]);
          await refreshAccount(accounts[0]);
        }
      } catch (e) { console.error("Wallet restore:", e); }
    };
    restore();
  }, []);
  useEffect(() => {
    if (!window.ethereum) return;
    const changed = (accounts) => {
      const addr = accounts?.[0] || "";
      setAccount(addr);
      if (addr) {
        // ตรวจสอบ network โดยไม่ขออนุญาตเชื่อมต่อซ้ำ
        const provider = new ethers.BrowserProvider(window.ethereum);
        provider.getNetwork()
          .then((network) => {
            if (Number(network.chainId) !== CHAIN_ID) {
              setRole({ admin: false, issuer: false });
              setRoleError(true);
              setRoleReady(true);
              notify("กรุณาเลือก Ethereum Sepolia", "error");
            } else return refreshAccount(addr);
          })
          .catch((e) => {
            setRole({ admin: false, issuer: false });
            setRoleError(true);
            setRoleReady(true);
            notify(errorMessage(e), "error");
          });
      } else refreshAccount("");
    };
    const chainChanged = () => {
      setAccount("");
      setRole({ admin: false, issuer: false });
      setMyCerts([]);
      setRoleReady(false);
      setRoleError(false);
      notify("เครือข่ายเปลี่ยนแล้ว กรุณาเชื่อมต่อใหม่", "error");
    };
    window.ethereum.on("accountsChanged", changed);
    window.ethereum.on("chainChanged", chainChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", changed);
      window.ethereum.removeListener("chainChanged", chainChanged);
    };
  }, []);
  useEffect(() => {
    if (roleLoading || (account && !roleReady)) return;
    // ลิงก์ QR สามารถเปิดหน้าตรวจสอบใบรับรองได้ทุก Role
    if (new URLSearchParams(window.location.search).has("cert") && page === "verify") return;
    if (page === (isAdmin ? "admin-dashboard" : "overview")) return;
    if (!items.some((item) => item.id === page)) {
      setPage(isAdmin ? "admin-dashboard" : "overview");
    } else if (isAdmin && page === "overview") {
      setPage("admin-dashboard");
    }
  }, [roleLoading, roleReady, role.admin, role.issuer, account, page]);

  async function transact(callback, after) {
    setBusy(true);
    setNotice(null);
    try {
      const contract = await writeContract();
      const tx = await callback(contract);
      notify("กำลังรอยืนยันธุรกรรมบน Blockchain...");
      await tx.wait();
      notify("บันทึกธุรกรรมสำเร็จ");
      if (after) await after();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  async function refreshHistory() {
    setHistoryBusy(true);
    setHistoryProgress("กำลังอ่าน Events...");
    try {
      const entries = await loadHistory(({end,latest,count}) => setHistoryProgress(`ตรวจถึงบล็อก ${end.toLocaleString()} / ${latest.toLocaleString()} • ${count} รายการ`));
      setHistory(entries);
      setHistoryProgress(`พบ ${entries.length} รายการ`);
    } catch (e) { notify("อ่านประวัติไม่สำเร็จ: " + errorMessage(e), "error"); }
    finally { setHistoryBusy(false); }
  }
  useEffect(() => { if (page === "history" && !historyBusy && history.length === 0) refreshHistory(); }, [page]);
  async function verify() {
    setBusy(true);
    setVerified(null);
    setNotice(null);
    try {
      if (!verifyId.trim()) throw Error("กรุณากรอกรหัสใบรับรอง");
      const contract = readContract();
      const cert = await contract.getCertificate(verifyId.trim());
      const hash = verifyFile ? await sha256File(verifyFile) : null;
      const matches = hash
        ? hash.toLowerCase() === cert.documentHash.toLowerCase()
        : null;
      setVerified({ cert, matches, hash });
      setRevokeInfo(null);
      if (cert.revoked) {
        try { setRevokeInfo(await contract.getRevocationInfo(verifyId.trim())); }
        catch (e) { console.warn("Cannot read revocation info:", e); }
      }
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  function openCertificate(id) {
    setVerifyId(id);
    setVerifyFile(null);
    setVerified(null);
    setRevokeInfo(null);
    setPage("verify");
    setMobile(false);
    window.scrollTo(0, 0);
  }
  const verificationUrl = verified
    ? `${location.origin}${location.pathname}?cert=${encodeURIComponent(verified.cert.certificateId)}`
    : "";
  const title = allItems.find((i) => i.id === page)?.label || "ภาพรวมระบบ";
  return (
    <div className="shell">
      <aside className={`sidebar ${mobile ? "visible" : ""}`}>
        <div className="brand">
          <button type="button" className="brand-home" title="กลับหน้าหลัก" onClick={() => {setPage(isAdmin ? "admin-dashboard" : "overview"); setMobile(false); setNotice(null);}}>
            <div className="brand-icon"><GraduationCap size={23} /></div>
            <div><strong>SkillTrust</strong><small>ACADEMY</small></div>
          </button>
          <button className="mobile-close" onClick={() => setMobile(false)}>
            <X />
          </button>
        </div>
        <div className="nav-heading">เมนูหลัก</div>
        <nav>
          {items
            .map((item) => (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "active" : ""}`}
                onClick={() => {
                  setPage(item.id);
                  setMobile(false);
                  setNotice(null);
                }}
              >
                <item.icon size={19} />
                {item.label}
              </button>
            ))}
        </nav>
        <div className="side-bottom">
          <div className="network-dot" /> Ethereum Sepolia{" "}
          <small>Blockchain Testnet</small>
        </div>
      </aside>
      {mobile && <div className="backdrop" onClick={() => setMobile(false)} />}
      <div className="workspace">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMobile(true)}>
            <Menu size={22} />
          </button>
          <div className="breadcrumbs">
            SkillTrust <span>/</span> <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <span className="chain-pill">
              <span /> Sepolia
            </span>
            <button
              type="button"
              className="wallet-btn"
              title={roleError ? "ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาตรวจสอบ RPC และ Contract Address" : `บทบาทปัจจุบัน: ${roleLabel}`}
              onClick={() => account && !roleLoading ? refreshAccount(account) : onConnect()}
              disabled={roleLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              <ShieldCheck size={16} /> {roleLabel}
            </button>
            <button className="wallet-btn" onClick={onConnect}>
              <Wallet size={17} />
              {account ? shortAddress(account) : "เชื่อมต่อ Wallet"}
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page-head">
            <div>
              <div className="eyebrow">BLOCKCHAIN CERTIFICATE PLATFORM</div>
              <h1>{title}</h1>
              <p>จัดการและตรวจสอบใบรับรองดิจิทัลอย่างโปร่งใสและปลอดภัย</p>
            </div>
            {page === "overview" && (
              <button className="primary" onClick={() => setPage("verify")}>
                <Search size={17} /> ตรวจสอบใบรับรอง
              </button>
            )}
          </div>
          {!configured && (
            <Status type="error">
              ยังไม่ได้กำหนด Contract Address — สร้างไฟล์ .env ตาม README
              แล้วรีสตาร์ท Vite
            </Status>
          )}
          {notice && <Status type={notice.type}>{notice.message}</Status>}
          {page === "admin-dashboard" && isAdmin && (
            <section className="panel">
              <div className="panel-title">
                <h3><ShieldCheck size={20} /> Admin Dashboard</h3>
              </div>
              <p>จัดการหลักสูตร ใบรับรอง และสิทธิ์ผู้ใช้งานบน Ethereum Sepolia</p>
              <div className="stats">
                <div className="stat">
                  <BookOpen size={25} />
                  <small>หลักสูตรทั้งหมด</small>
                  <strong>{courses.length}</strong>
                </div>
                <div className="stat">
                  <BadgeCheck size={25} />
                  <small>ใบรับรองของ Wallet นี้</small>
                  <strong>{myCerts.length}</strong>
                </div>
              </div>
              <div className="admin-shortcuts">
                <button onClick={() => setPage("courses")}><BookOpen size={18} /> จัดการหลักสูตร <ArrowRight size={16} /></button>
                <button onClick={() => setPage("issue")}><BadgeCheck size={18} /> ออกใบรับรอง <ArrowRight size={16} /></button>
                <button onClick={() => setPage("revoke")}><ShieldX size={18} /> เพิกถอนใบรับรอง <ArrowRight size={16} /></button>
                <button onClick={() => setPage("permissions")}><Users size={18} /> กำหนดสิทธิ์ผู้ออก <ArrowRight size={16} /></button>
                <button onClick={() => setPage("history")}><RefreshCw size={18} /> ประวัติธุรกรรม <ArrowRight size={16} /></button>
              </div>
            </section>
          )}
          {page === "overview" && !isAdmin && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="hero-label">
                    <ShieldCheck size={15} /> VERIFIED ON ETHEREUM
                  </div>
                  <h2>
                    ใบรับรองที่เชื่อถือได้
                    <br />
                    ตรวจสอบได้ทุกที่
                  </h2>
                  <p>
                    ยืนยันความถูกต้องของเอกสารผ่าน Blockchain
                    โดยไม่เปิดเผยข้อมูลส่วนบุคคล
                  </p>
                  <button
                    className="hero-button"
                    onClick={() => setPage("verify")}
                  >
                    เริ่มตรวจสอบ <ArrowRight size={18} />
                  </button>
                </div>
                <div className="hero-graphic">
                  <div className="graphic-orbit">
                    <div className="graphic-inner">
                      <BadgeCheck size={66} />
                    </div>
                  </div>
                  <div className="floating-badge">
                    <CheckCircle2 size={16} /> Blockchain secured
                  </div>
                </div>
              </section>
              <div className="stats">
                <div className="stat">
                  <span className="stat-icon violet">
                    <BookOpen />
                  </span>
                  <small>หลักสูตรทั้งหมด</small>
                  <strong>{courses.length}</strong>
                  <span>รายการบน Smart Contract</span>
                </div>
                <div className="stat">
                  <span className="stat-icon blue">
                    <BadgeCheck />
                  </span>
                  <small>ใบรับรองของฉัน</small>
                  <strong>{myCerts.length}</strong>
                  <span>ผูกกับ Wallet ที่เชื่อมต่อ</span>
                </div>
                <div className="stat">
                  <span className="stat-icon green">
                    <ShieldCheck />
                  </span>
                  <small>ใบรับรองที่ยังใช้ได้</small>
                  <strong>{myCerts.filter((c) => !c.revoked).length}</strong>
                  <span>ยังไม่ถูกเพิกถอน</span>
                </div>
              </div>
              <div className="two-col">
                <section className="panel">
                  <div className="panel-title">
                    <h3>เริ่มต้นใช้งาน</h3>
                    <span>QUICK ACTIONS</span>
                  </div>
                  <div className="quick-grid">
                    <button onClick={() => setPage("verify")}>
                      <span className="quick-icon">
                        <Search />
                      </span>
                      <strong>ตรวจสอบใบรับรอง</strong>
                      <small>ค้นหารหัสหรืออัปโหลด PDF</small>
                      <ArrowRight size={17} />
                    </button>
                    <button onClick={() => setPage("mine")}>
                      <span className="quick-icon purple">
                        <Wallet />
                      </span>
                      <strong>ใบรับรองของฉัน</strong>
                      <small>ดูรายการผ่าน MetaMask</small>
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <h3>ระบบทำงานอย่างไร?</h3>
                  </div>
                  <div className="steps">
                    <div>
                      <b>01</b>
                      <span>
                        <strong>ออกใบรับรอง</strong>
                        <small>ผู้มีสิทธิ์บันทึกรหัสและ Hash เอกสาร</small>
                      </span>
                    </div>
                    <div>
                      <b>02</b>
                      <span>
                        <strong>บันทึกบน Blockchain</strong>
                        <small>ข้อมูลหลักฐานถูกจัดเก็บบน Ethereum</small>
                      </span>
                    </div>
                    <div>
                      <b>03</b>
                      <span>
                        <strong>ตรวจสอบได้ทันที</strong>
                        <small>ค้นหาด้วยรหัสหรือสแกน QR Code</small>
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "verify" && (
            <div className="two-col verify-layout">
              <section className="panel">
                <div className="panel-title">
                  <h3>
                    <Search size={20} /> ค้นหาใบรับรอง
                  </h3>
                </div>
                <Field label="รหัสใบรับรอง">
                  <input
                    placeholder="เช่น ST-2026-0001"
                    value={verifyId}
                    onChange={(e) => setVerifyId(e.target.value)}
                  />
                </Field>
                <Field label="อัปโหลด PDF เพื่อตรวจสอบ Hash (แนะนำ)">
                  <div className="file-drop">
                    <UploadCloud size={25} />
                    <span>{verifyFile?.name || "เลือกไฟล์ใบรับรอง PDF"}</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) =>
                        setVerifyFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                </Field>
                <button
                  className="primary wide"
                  disabled={busy}
                  onClick={verify}
                >
                  <ShieldCheck size={18} />
                  {busy ? "กำลังตรวจสอบ..." : "ตรวจสอบใบรับรอง"}
                </button>
                <p className="helper">
                  ค้นหาด้วยรหัสเพื่อดูสถานะ และแนบ PDF
                  เพื่อพิสูจน์ว่าเนื้อหาไม่ถูกแก้ไข
                </p>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h3>ผลการตรวจสอบ</h3>
                </div>
                {!verified ? (
                  <Empty
                    title="ยังไม่มีผลการตรวจสอบ"
                    text="กรอกรหัสใบรับรองแล้วกดตรวจสอบ"
                  />
                ) : (
                  <div className="result">
                    <div
                      className={`result-status ${verified.cert.revoked || verified.matches === false ? "bad" : "good"}`}
                    >
                      {verified.cert.revoked || verified.matches === false ? (
                        <ShieldX size={32} />
                      ) : (
                        <ShieldCheck size={32} />
                      )}
                      <strong>
                        {verified.cert.revoked
                          ? "ใบรับรองถูกเพิกถอน"
                          : verified.matches === false
                            ? "ไฟล์ไม่ตรงกับหลักฐาน"
                            : verified.matches === true
                              ? "ใบรับรองถูกต้องและไฟล์ตรงกัน"
                              : "พบใบรับรองที่ยังไม่ถูกเพิกถอน"}
                      </strong>
                      <small>
                        {verified.matches === null
                          ? "ยังไม่ได้ตรวจสอบความตรงกันของไฟล์ PDF"
                          : "ตรวจสอบเทียบกับ Hash ที่บันทึกบน Blockchain"}
                      </small>
                    </div>
                    <div className="detail-row">
                      <span>รหัสใบรับรอง</span>
                      <b>{verified.cert.certificateId}</b>
                    </div>
                    <div className="detail-row">
                      <span>รหัสหลักสูตร</span>
                      <b>{verified.cert.courseCode}</b>
                    </div>
                    <div className="detail-row">
                      <span>Wallet ผู้รับ</span>
                      <b className="mono">
                        {shortAddress(verified.cert.recipient)}
                      </b>
                    </div>
                    <div className="detail-row">
                      <span>วันที่ออก</span>
                      <b>
                        {new Date(
                          Number(verified.cert.issuedAt) * 1000,
                        ).toLocaleString("th-TH")}
                      </b>
                    </div>
                    <div className="detail-row">
                      <span>Document Hash</span>
                      <b className="hash">{verified.cert.documentHash}</b>
                    </div>
                    {verified.cert.revoked && revokeInfo && <div className="revocation-note">
                      <strong>รายละเอียดการเพิกถอน</strong>
                      <p>เหตุผล: {revokeInfo.reason}</p>
                      <p>ผู้เพิกถอน: {shortAddress(revokeInfo.revokedBy)}</p>
                      <p>วันที่: {new Date(Number(revokeInfo.revokedAt) * 1000).toLocaleString("th-TH")}</p>
                    </div>}
                    <div className="qr-area">
                      <QRCodeSVG value={verificationUrl} size={122} />
                      <div>
                        <strong>QR สำหรับตรวจสอบ</strong>
                        <small>สแกนเพื่อเปิดหน้าตรวจสอบใบรับรองนี้</small>
                        <button
                          className="text-btn"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(verificationUrl)
                              .then(() => notify("คัดลอกลิงก์แล้ว"))
                              .catch(() =>
                                notify("ไม่สามารถคัดลอกลิงก์ได้", "error"),
                              )
                          }
                        >
                          <Copy size={14} /> คัดลอกลิงก์
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
          {page === "mine" && (
            <section className="panel">
              <div className="panel-title">
                <h3>ใบรับรองที่ผูกกับ Wallet</h3>
                <button
                  className="text-btn"
                  onClick={() =>
                    account ? refreshAccount(account) : onConnect()
                  }
                >
                  <RefreshCw size={15} /> รีเฟรช
                </button>
              </div>
              {!account ? (
                <div className="empty">
                  <Wallet size={35} />
                  <strong>เชื่อมต่อ MetaMask เพื่อดูใบรับรอง</strong>
                  <button className="primary" onClick={onConnect}>
                    <Wallet size={16} /> เชื่อมต่อ Wallet
                  </button>
                </div>
              ) : myCerts.length ? (
                <div className="cert-list">
                  {myCerts.map((c) => (
                    <CertificateCard
                      key={c.certificateId}
                      cert={c}
                      onOpen={openCertificate}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  title="ยังไม่มีใบรับรอง"
                  text="เมื่อได้รับใบรับรอง รายการจะแสดงที่นี่"
                />
              )}
            </section>
          )}
          {page === "courses" && role.admin && (
            <div className="two-col">
              <section className="panel">
                <div className="panel-title">
                  <h3>
                    <Plus size={20} /> เพิ่มหลักสูตร
                  </h3>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    transact(
                      (c) =>
                        c.createCourse(
                          courseForm.code.trim(),
                          courseForm.title.trim(),
                          courseForm.description.trim(),
                        ),
                      async () => {
                        setCourseForm({ code: "", title: "", description: "" });
                        await refreshCourses();
                      },
                    );
                  }}
                >
                  <Field label="รหัสหลักสูตร">
                    <input
                      required
                      placeholder="เช่น WEB3-101"
                      value={courseForm.code}
                      onChange={(e) =>
                        setCourseForm({ ...courseForm, code: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="ชื่อหลักสูตร">
                    <input
                      required
                      placeholder="เช่น Blockchain Fundamentals"
                      value={courseForm.title}
                      onChange={(e) =>
                        setCourseForm({ ...courseForm, title: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="รายละเอียด">
                    <textarea
                      rows="4"
                      placeholder="รายละเอียดการอบรม"
                      value={courseForm.description}
                      onChange={(e) =>
                        setCourseForm({
                          ...courseForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <button className="primary wide" disabled={busy}>
                    <Plus size={17} />{" "}
                    {busy ? "กำลังบันทึก..." : "สร้างหลักสูตร"}
                  </button>
                </form>
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h3>หลักสูตรทั้งหมด ({courses.length})</h3>
                  <button className="text-btn" onClick={refreshCourses}>
                    <RefreshCw size={15} />
                  </button>
                </div>
                {courses.length ? (
                  <div className="course-list">
                    {courses.map((c) => (
                      <div className="course-item" key={c.code}>
                        <span className="course-icon">
                          <GraduationCap size={21} />
                        </span>
                        <div>
                          <strong>{c.title}</strong>
                          <small>{c.code}</small>
                          <p>{c.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="ยังไม่มีหลักสูตร"
                    text="เพิ่มหลักสูตรแรกของ Academy"
                  />
                )}
              </section>
            </div>
          )}
          {page === "issue" && (role.admin || role.issuer) && (
            <section className="panel narrow">
              <div className="panel-title">
                <h3>
                  <BadgeCheck size={20} /> ออกใบรับรองใหม่
                </h3>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!issueFile) return notify("กรุณาเลือกไฟล์ PDF", "error");
                  sha256File(issueFile)
                    .then((hash) =>
                      transact(
                        (c) =>
                          c.issueCertificate(
                            issueForm.id.trim(),
                            issueForm.course,
                            issueForm.wallet.trim(),
                            hash,
                          ),
                        async () => {
                          setIssueForm(initialIssue);
                          setIssueFile(null);
                          if (account) await refreshAccount(account);
                        },
                      ),
                    )
                    .catch((e) => notify(errorMessage(e), "error"));
                }}
              >
                <Field label="รหัสใบรับรอง (ห้ามซ้ำ)">
                  <input
                    required
                    placeholder="ST-2026-0001"
                    value={issueForm.id}
                    onChange={(e) =>
                      setIssueForm({ ...issueForm, id: e.target.value })
                    }
                  />
                </Field>
                <Field label="หลักสูตร">
                  <select
                    required
                    value={issueForm.course}
                    onChange={(e) =>
                      setIssueForm({ ...issueForm, course: e.target.value })
                    }
                  >
                    <option value="">เลือกหลักสูตร</option>
                    {courses.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Wallet Address ของผู้รับ">
                  <input
                    required
                    placeholder="0x..."
                    value={issueForm.wallet}
                    onChange={(e) =>
                      setIssueForm({ ...issueForm, wallet: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="ไฟล์ใบรับรอง PDF"
                  hint="Hash จะคำนวณในเบราว์เซอร์ ไม่อัปโหลดไฟล์ขึ้น Blockchain"
                >
                  <div className="file-drop">
                    <UploadCloud size={25} />
                    <span>
                      {issueFile?.name || "เลือกไฟล์ PDF ที่ออกให้ผู้เรียนแล้ว"}
                    </span>
                    <input
                      required
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) =>
                        setIssueFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                </Field>
                <button disabled={busy} className="primary wide">
                  <BadgeCheck size={18} />
                  {busy ? "กำลังดำเนินการ..." : "ลงนามและออกใบรับรอง"}
                </button>
              </form>
            </section>
          )}
          {page === "revoke" && role.admin && (
            <section className="panel narrow">
              <div className="panel-title">
                <h3>
                  <ShieldX size={20} /> เพิกถอนใบรับรอง
                </h3>
              </div>
              <Status type="error">
                การเพิกถอนมีผลถาวรบน Smart Contract
                และไม่ลบประวัติการออกใบรับรอง
              </Status>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!revokeReason.trim()) return notify("กรุณาระบุเหตุผล", "error");
                  if (!window.confirm(`ยืนยันเพิกถอน ${revokeId}? เหตุผลจะเปิดเผยบน Blockchain`)) return;
                  transact(
                    (c) => c.revokeCertificate(revokeId.trim(), revokeReason.trim()),
                    () => {
                      setRevokeId("");
                      setRevokeReason("");
                      return refreshAccount(account);
                    },
                  );
                }}
              >
                <Field label="รหัสใบรับรอง">
                  <input
                    required
                    placeholder="ST-2026-0001"
                    value={revokeId}
                    onChange={(e) => setRevokeId(e.target.value)}
                  />
                </Field>
                <Field label="เหตุผลการเพิกถอน (บันทึกบน Public Blockchain)">
                  <textarea required maxLength={300} rows={3} placeholder="เช่น ออกใบรับรองผิดพลาด (ไม่ใส่ข้อมูลส่วนบุคคล)" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
                </Field>
                <button disabled={busy} className="danger-btn wide">
                  <ShieldX size={17} />
                  {busy ? "กำลังดำเนินการ..." : "ยืนยันการเพิกถอน"}
                </button>
              </form>
            </section>
          )}
          {page === "history" && (
            <section className="panel">
              <div className="panel-title"><h3><RefreshCw size={20}/> ประวัติธุรกรรมจาก Blockchain</h3>
                <button className="text-btn" disabled={historyBusy} onClick={refreshHistory}><RefreshCw size={15}/> โหลดใหม่</button>
              </div>
              <p className="helper">อ่าน Events จาก Contract ที่ตั้งค่าไว้ ตั้งแต่ VITE_DEPLOYMENT_BLOCK ถึงบล็อกล่าสุด (หากไม่กำหนด จะอ่านย้อนหลัง 45,000 บล็อก)</p>
              <p className="helper">{historyBusy ? "กำลังโหลด: " : ""}{historyProgress}</p>
              <div className="history-list">
                {history.length === 0 && !historyBusy ? <Empty title="ยังไม่พบ Events" text="ตรวจสอบ Contract Address, Deployment Block และ Infura" /> : null}
                {history.map((item) => <div className="history-item" key={`${item.hash}-${item.index}`}>
                  <div><strong>{({CertificateIssued:"ออกใบรับรอง",CertificateRevoked:"เพิกถอนใบรับรอง",CourseCreated:"สร้างหลักสูตร",IssuerUpdated:"กำหนดสิทธิ์ Issuer"})[item.name] || item.name}</strong>
                    <small>{item.name === "CertificateIssued" || item.name === "CertificateRevoked" ? `Certificate ID: ${item.args.certificateId}` : item.name === "CourseCreated" ? `Course: ${item.args.code}` : `Issuer: ${shortAddress(item.args.issuer)} (${item.args.allowed ? "อนุญาต" : "ยกเลิก"})`}</small>
                    {item.name === "CertificateRevoked" && <small>เหตุผล: {item.args.reason}</small>}
                    <small>Block #{item.block}</small></div>
                  <a href={`${EXPLORER}/tx/${item.hash}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Etherscan</a>
                </div>)}
              </div>
            </section>
          )}
          {page === "permissions" && role.admin && (
            <section className="panel narrow">
              <div className="panel-title">
                <h3>
                  <LockKeyhole size={20} /> กำหนดสิทธิ์ผู้ออกใบรับรอง
                </h3>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  transact(
                    (c) => c.setIssuer(issuerAddress.trim(), issuerAllowed),
                    () => {
                      setIssuerAddress("");
                      return refreshAccount(account);
                    },
                  );
                }}
              >
                <Field label="Wallet Address">
                  <input
                    required
                    placeholder="0x..."
                    value={issuerAddress}
                    onChange={(e) => setIssuerAddress(e.target.value)}
                  />
                </Field>
                <Field label="การอนุญาต">
                  <select
                    value={issuerAllowed ? "yes" : "no"}
                    onChange={(e) => setIssuerAllowed(e.target.value === "yes")}
                  >
                    <option value="yes">อนุญาตให้ออกใบรับรอง</option>
                    <option value="no">ยกเลิกสิทธิ์ออกใบรับรอง</option>
                  </select>
                </Field>
                <button className="primary wide" disabled={busy}>
                  <LockKeyhole size={17} />
                  {busy ? "กำลังบันทึก..." : "บันทึกสิทธิ์"}
                </button>
              </form>
            </section>
          )}
          <footer>
            © 2026 SkillTrust Academy{" "}
            <span>Powered by Ethereum · MetaMask · Infura</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
