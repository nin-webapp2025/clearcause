# Fundly: Web3-Powered Crowdfunding Platform 🚀

> **🚨 LIVE ON CROSSFI MAINNET!** Fundly is now fully operational on CrossFi mainnet. Start creating and backing campaigns today!

## Overview

Fundly is a decentralized crowdfunding platform built on the CrossFi blockchain that revolutionizes how creators and entrepreneurs raise funds. By leveraging blockchain technology, Fundly ensures transparency, security, and trust in the crowdfunding process. The platform combines traditional crowdfunding concepts with Web3 innovations to create a more efficient and trustworthy fundraising ecosystem.

> **🎉 Production Ready**: Fundly is live and fully functional on CrossFi mainnet, ready for real-world campaigns and contributions.

## Why Fundly?

- **Production Ready**: Fully operational on CrossFi mainnet with verified smart contracts
- **Transparency**: All transactions and campaign progress are recorded on the blockchain, providing complete transparency
- **Security**: Smart contracts ensure funds are managed securely and released according to predefined milestones
- **Trust**: KYC verification system builds trust between campaign creators and backers
- **Innovation**: NFT-based contribution tracking and reputation system incentivize active participation
- **Governance**: Community-driven decision making through proposal and voting mechanisms

## Core Features

### 1. Campaign Management
- Create campaigns with detailed descriptions, funding goals, and milestones
- Set campaign duration (1-90 days) and minimum funding target (0.1 XFI)
- Track campaign progress in real-time with on-chain analytics
- Automatic status updates (Active, Successful, Failed, Paid)

### 2. Smart Contract Integration
- Automated fund distribution through milestone-based smart contracts
- Secure escrow system for campaign funds
- Automatic status updates based on funding progress
- Transparent fund allocation and withdrawal process

### 3. NFT Contribution System
- Each contribution is recorded as an NFT
- Unique NFT for every donation with campaign details
- Proof of contribution stored on-chain
- NFT metadata includes contribution amount and campaign information

### 4. KYC Verification
- Mandatory KYC verification for campaign creators
- Secure identity verification process
- Document verification system
- Privacy-focused KYC data management

### 5. Governance System
- Create proposals for campaign fund allocation
- Community voting on proposals
- Quorum-based decision making (5.0 tokens)
- Transparent voting process with on-chain records

### 6. Reputation System
- User reputation tracking based on:
  - Campaign creation and success
  - Contribution history
  - Governance participation
  - Community engagement
- Reputation tiers (1-3) with increasing benefits
- Reputation score updates with each action

### 7. Campaign Analytics
- Real-time funding progress tracking
- Donor statistics and contribution patterns
- Milestone completion tracking
- Campaign performance metrics

## Technical Architecture

### Smart Contracts

#### Fundly.sol (Main Contract)
- **Campaign Management**
  - Campaign creation and configuration
  - Fund collection and distribution
  - Milestone tracking and management
  - Status updates and state management

- **Governance System**
  - Proposal creation and management
  - Voting mechanism implementation
  - Quorum validation
  - Proposal execution

- **Reputation System**
  - User activity tracking
  - Reputation score calculation
  - Tier management
  - Activity rewards

#### KYCManager.sol
- User identity verification
- Document management
- Verification status tracking
- Admin controls for verification

### Frontend Architecture

#### Technology Stack
- **Framework**: React.js with Vite for fast development and optimal performance
- **State Management**: React Hooks and Context API for efficient state handling
- **UI Components**: Custom components with Framer Motion for smooth animations
- **Blockchain Integration**: Reown AppKit and ethers.js for blockchain interaction
- **Styling**: Modern, responsive design with custom CSS

#### Key Components
- Campaign creation and management interface
- Campaign discovery and browsing
- User dashboard with analytics
- KYC verification portal
- Governance interface
- Wallet integration

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MetaMask or compatible Web3 wallet
- CrossFi network configured in your wallet (Chain ID: 4158)
- XFI tokens for gas fees

> **Quick Start**: Visit [Fundly App](www.fundlyapp.xyz/) to start using the platform on CrossFi mainnet!

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Kanasjnr/Fundly.git
   ```

2. Install dependencies:
   ```bash
   cd fundly
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory with:
   ```
   VITE_APP_CROSSFI_RPC_URL=your_rpc_url
   VITE_APP_CROSSFI_EXPLORER_URL=your_explorer_url
   VITE_APP_APPKIT_PROJECT_ID=your_project_id
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Access the application at `http://localhost:3000`

### Smart Contract Deployment

1. Compile contracts:
   ```bash
   npx hardhat compile
   ```

2. Deploy to CrossFi Mainnet:
   ```bash
   npx hardhat deploy --network crossfi-mainnet
   ```

## Network Information

### 🚀 CrossFi Mainnet (LIVE)
- **Status**: ✅ Production Ready
- **Chain ID**: 4158
- **Native Currency**: XFI
- **Contract Addresses** (Verified):
  - Fundly Main Contract: `0x2b2A944CeF81C24fd5bBa7EbE34F318D9d57A48b`
  - KYC Manager: `0x75E4Eb5F40c48e89e0FDA6e32E88459F5d97183D`
- **Initial Quorum**: 5.0 tokens

> **Ready to Use**: The platform is fully operational on CrossFi mainnet. Connect your wallet and start creating or backing campaigns today!

## Security

### Smart Contract Security
- Comprehensive testing suite
- OpenZeppelin contracts integration
- Access control mechanisms
- Emergency pause functionality
- Regular security audits

### User Security
- KYC verification system
- Secure fund management
- Transparent transaction history
- Protected user data

## Contributing

We welcome contributions to Fundly! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- Pull request process
- Testing requirements
- Documentation standards

## Support

- **Technical Support**: File an issue on GitHub
- **General Inquiries**: Contact info@fundlyapp.xyz
- **Security Issues**: Email fundly101@gmail.com (DO NOT use GitHub issues)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

---

Empowering decentralized fundraising with Fundly 🚀