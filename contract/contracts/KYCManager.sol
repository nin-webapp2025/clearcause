// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Stores only a non-reversible proof and verification state. Personal
/// information and identity documents belong in the authenticated backend.
contract KYCManager is Ownable {
    struct KYC { bytes32 proofHash; bool submitted; bool isVerified; }
    mapping(address => KYC) private _userKYC;
    address[] private _pendingVerifications;
    mapping(address => bool) private _isPending;

    event KYCSubmitted(address indexed user, bytes32 indexed proofHash);
    event KYCVerified(address indexed user, bool isVerified);
    constructor() Ownable(msg.sender) {}

    function submitKYC(bytes32 proofHash) external {
        require(proofHash != bytes32(0), "Proof is required");
        _userKYC[msg.sender] = KYC(proofHash, true, false);
        if (!_isPending[msg.sender]) { _pendingVerifications.push(msg.sender); _isPending[msg.sender] = true; }
        emit KYCSubmitted(msg.sender, proofHash);
    }

    function verifyKYC(address user, bool status) external onlyOwner {
        require(_userKYC[user].submitted, "User has not submitted KYC");
        _userKYC[user].isVerified = status;
        for (uint256 i = 0; i < _pendingVerifications.length; i++) {
            if (_pendingVerifications[i] == user) {
                _pendingVerifications[i] = _pendingVerifications[_pendingVerifications.length - 1];
                _pendingVerifications.pop();
                _isPending[user] = false;
                break;
            }
        }
        emit KYCVerified(user, status);
    }

    function isUserVerified(address user) external view returns (bool) { return _userKYC[user].isVerified; }
    function getPendingVerifications() external view onlyOwner returns (address[] memory) { return _pendingVerifications; }
    function getPendingVerificationCount() external view returns (uint256) { return _pendingVerifications.length; }
    function getKYCProof(address user) external view returns (bytes32 proofHash, bool submitted, bool isVerified) {
        KYC memory kyc = _userKYC[user];
        return (kyc.proofHash, kyc.submitted, kyc.isVerified);
    }
}
