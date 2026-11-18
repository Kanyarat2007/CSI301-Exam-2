// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SkillTrustCertificates {
    address public immutable admin;
    mapping(address => bool) public issuers;

    struct Course { string code; string title; string description; bool exists; }
    struct Certificate {
        string certificateId;
        string courseCode;
        address recipient;
        bytes32 documentHash;
        uint64 issuedAt;
        bool revoked;
        bool exists;
    }
    mapping(string => Course) private courses;
    string[] private courseCodes;
    mapping(string => Certificate) private certificates;
    mapping(address => string[]) private walletCertificateIds;

    struct RevocationInfo { string reason; address revokedBy; uint64 revokedAt; }
    mapping(string => RevocationInfo) private revocations;

    event CourseCreated(bytes32 indexed codeHash, string code, string title);
    event IssuerUpdated(address indexed issuer, bool allowed);
    event CertificateIssued(bytes32 indexed idHash, string certificateId, address indexed recipient, bytes32 documentHash);
    event CertificateRevoked(bytes32 indexed idHash, string certificateId, address indexed revokedBy, string reason, uint64 revokedAt);

    modifier onlyAdmin() { require(msg.sender == admin, "Only admin"); _; }
    modifier onlyIssuer() { require(msg.sender == admin || issuers[msg.sender], "Not an issuer"); _; }

    constructor() { admin = msg.sender; }
    function setIssuer(address account, bool allowed) external onlyAdmin {
        require(account != address(0), "Zero address");
        issuers[account] = allowed;
        emit IssuerUpdated(account, allowed);
    }
    function createCourse(string calldata code, string calldata title, string calldata description) external onlyAdmin {
        require(bytes(code).length > 0 && bytes(title).length > 0, "Required fields");
        require(!courses[code].exists, "Course exists");
        courses[code] = Course(code, title, description, true);
        courseCodes.push(code);
        emit CourseCreated(keccak256(bytes(code)), code, title);
    }
    function getCourses() external view returns (Course[] memory result) {
        result = new Course[](courseCodes.length);
        for (uint i; i < courseCodes.length; ++i) result[i] = courses[courseCodes[i]];
    }
    function issueCertificate(string calldata id, string calldata courseCode, address recipient, bytes32 documentHash) external onlyIssuer {
        require(bytes(id).length > 0, "ID required");
        require(!certificates[id].exists, "Certificate ID exists");
        require(courses[courseCode].exists, "Unknown course");
        require(recipient != address(0), "Zero recipient");
        require(documentHash != bytes32(0), "Empty hash");
        certificates[id] = Certificate(id, courseCode, recipient, documentHash, uint64(block.timestamp), false, true);
        walletCertificateIds[recipient].push(id);
        emit CertificateIssued(keccak256(bytes(id)), id, recipient, documentHash);
    }
    function getCertificate(string calldata id) external view returns (Certificate memory) {
        require(certificates[id].exists, "Certificate not found");
        return certificates[id];
    }
    function verifyCertificate(string calldata id, bytes32 providedHash) external view returns (bool valid, bool revoked, bool hashMatches) {
        Certificate storage cert = certificates[id];
        if (!cert.exists) return (false, false, false);
        bool matches = cert.documentHash == providedHash;
        return (!cert.revoked && matches, cert.revoked, matches);
    }
    function getWalletCertificateIds(address wallet) external view returns (string[] memory) {
        return walletCertificateIds[wallet];
    }
    function getRevocationInfo(string calldata id) external view returns (RevocationInfo memory) {
        require(certificates[id].exists, "Certificate not found");
        return revocations[id];
    }
    function revokeCertificate(string calldata id, string calldata reason) external onlyAdmin {
        require(bytes(reason).length > 0 && bytes(reason).length <= 300, "Reason required (max 300 bytes)");
        require(certificates[id].exists, "Certificate not found");
        require(!certificates[id].revoked, "Already revoked");
        certificates[id].revoked = true;
        revocations[id] = RevocationInfo(reason, msg.sender, uint64(block.timestamp));
        emit CertificateRevoked(keccak256(bytes(id)), id, msg.sender, reason, uint64(block.timestamp));
    }
}
