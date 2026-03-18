// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ICharityRegistryForPreferences {
    function isActiveCharity(uint256 charityId) external view returns (bool);
    function getDefaultCharityId() external view returns (uint256);
    function getCharityWallet(uint256 charityId) external view returns (address);
}

contract UserCharityPreferencesRegistry is Ownable {
    struct UserCharityPreferences {
        uint256 preferredCharityId; // 0 means "no explicit preference"
        uint16 voluntaryFeeBps;     // extra fee on top of token-level base fee
    }

    error ZeroAddressOwner();
    error ZeroAddressCharityRegistry();
    error InvalidPreferredCharity(uint256 charityId);
    error InvalidVoluntaryFeeBps(uint16 feeBps, uint16 maxFeeBps);
    error SameAddress();
    error CharityResolutionFailed(uint256 requestedCharityId);
    error ZeroWalletForResolvedCharity(uint256 charityId);

    event CharityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event MaxVoluntaryFeeBpsUpdated(uint16 oldMaxFeeBps, uint16 newMaxFeeBps);

    event PreferredCharityUpdated(
        address indexed user,
        uint256 indexed oldCharityId,
        uint256 indexed newCharityId
    );

    event VoluntaryFeeBpsUpdated(
        address indexed user,
        uint16 oldFeeBps,
        uint16 newFeeBps
    );

    event PreferencesUpdated(
        address indexed user,
        uint256 indexed oldCharityId,
        uint256 indexed newCharityId,
        uint16 oldFeeBps,
        uint16 newFeeBps
    );

    address public charityRegistry;
    uint16 public maxVoluntaryFeeBps;

    mapping(address => UserCharityPreferences) private _preferences;

    constructor(
        address initialOwner,
        address charityRegistry_,
        uint16 maxVoluntaryFeeBps_
    ) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        if (charityRegistry_ == address(0)) revert ZeroAddressCharityRegistry();
        _transferOwnership(initialOwner);

        charityRegistry = charityRegistry_;
        maxVoluntaryFeeBps = maxVoluntaryFeeBps_;

        emit CharityRegistryUpdated(address(0), charityRegistry_);
        emit MaxVoluntaryFeeBpsUpdated(0, maxVoluntaryFeeBps_);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setCharityRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddressCharityRegistry();
        if (newRegistry == charityRegistry) revert SameAddress();

        address oldRegistry = charityRegistry;
        charityRegistry = newRegistry;

        emit CharityRegistryUpdated(oldRegistry, newRegistry);
    }

    function setMaxVoluntaryFeeBps(uint16 newMaxFeeBps) external onlyOwner {
        uint16 oldMaxFeeBps = maxVoluntaryFeeBps;
        maxVoluntaryFeeBps = newMaxFeeBps;

        emit MaxVoluntaryFeeBpsUpdated(oldMaxFeeBps, newMaxFeeBps);
    }

    // -------------------------------------------------------------------------
    // User writes
    // -------------------------------------------------------------------------

    function setPreferredCharity(uint256 charityId) external {
        if (charityId != 0 && !_isActiveCharity(charityId)) {
            revert InvalidPreferredCharity(charityId);
        }

        UserCharityPreferences storage pref = _preferences[msg.sender];
        uint256 oldCharityId = pref.preferredCharityId;
        pref.preferredCharityId = charityId;

        emit PreferredCharityUpdated(msg.sender, oldCharityId, charityId);
    }

    function clearPreferredCharity() external {
        UserCharityPreferences storage pref = _preferences[msg.sender];
        uint256 oldCharityId = pref.preferredCharityId;
        pref.preferredCharityId = 0;

        emit PreferredCharityUpdated(msg.sender, oldCharityId, 0);
    }

    function setVoluntaryFeeBps(uint16 feeBps) external {
        if (feeBps > maxVoluntaryFeeBps) {
            revert InvalidVoluntaryFeeBps(feeBps, maxVoluntaryFeeBps);
        }

        UserCharityPreferences storage pref = _preferences[msg.sender];
        uint16 oldFeeBps = pref.voluntaryFeeBps;
        pref.voluntaryFeeBps = feeBps;

        emit VoluntaryFeeBpsUpdated(msg.sender, oldFeeBps, feeBps);
    }

    function clearVoluntaryFeeBps() external {
        UserCharityPreferences storage pref = _preferences[msg.sender];
        uint16 oldFeeBps = pref.voluntaryFeeBps;
        pref.voluntaryFeeBps = 0;

        emit VoluntaryFeeBpsUpdated(msg.sender, oldFeeBps, 0);
    }

    function setPreferences(uint256 charityId, uint16 feeBps) external {
        if (charityId != 0 && !_isActiveCharity(charityId)) {
            revert InvalidPreferredCharity(charityId);
        }
        if (feeBps > maxVoluntaryFeeBps) {
            revert InvalidVoluntaryFeeBps(feeBps, maxVoluntaryFeeBps);
        }

        UserCharityPreferences storage pref = _preferences[msg.sender];

        uint256 oldCharityId = pref.preferredCharityId;
        uint16 oldFeeBps = pref.voluntaryFeeBps;

        pref.preferredCharityId = charityId;
        pref.voluntaryFeeBps = feeBps;

        emit PreferencesUpdated(
            msg.sender,
            oldCharityId,
            charityId,
            oldFeeBps,
            feeBps
        );
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getPreferences(address user)
        external
        view
        returns (uint256 preferredCharityId, uint16 voluntaryFeeBps)
    {
        UserCharityPreferences storage pref = _preferences[user];
        return (pref.preferredCharityId, pref.voluntaryFeeBps);
    }

    function getPreferredCharity(address user) external view returns (uint256) {
        return _preferences[user].preferredCharityId;
    }

    function getVoluntaryFeeBps(address user) external view returns (uint16) {
        return _preferences[user].voluntaryFeeBps;
    }

    /// @notice Resolve a user's current charity destination and voluntary fee.
    /// @dev If the stored preferred charity is zero or no longer active, falls back
    ///      to the CharityRegistry default charity.
    function resolveFeePreferences(address user)
        external
        view
        returns (
            uint256 resolvedCharityId,
            address charityWallet,
            uint16 voluntaryFeeBps
        )
    {
        UserCharityPreferences storage pref = _preferences[user];
        voluntaryFeeBps = pref.voluntaryFeeBps;

        resolvedCharityId = pref.preferredCharityId;

        if (resolvedCharityId == 0 || !_isActiveCharity(resolvedCharityId)) {
            resolvedCharityId = ICharityRegistryForPreferences(charityRegistry).getDefaultCharityId();
        }

        if (resolvedCharityId == 0 || !_isActiveCharity(resolvedCharityId)) {
            revert CharityResolutionFailed(pref.preferredCharityId);
        }

        charityWallet = ICharityRegistryForPreferences(charityRegistry).getCharityWallet(resolvedCharityId);
        if (charityWallet == address(0)) {
            revert ZeroWalletForResolvedCharity(resolvedCharityId);
        }
    }

    /// @notice Convenience method for frontends and token preview helpers.
    function previewResolvedCharity(address user)
        external
        view
        returns (
            uint256 requestedCharityId,
            uint256 resolvedCharityId,
            address charityWallet,
            bool fellBackToDefault
        )
    {
        requestedCharityId = _preferences[user].preferredCharityId;
        resolvedCharityId = requestedCharityId;

        if (resolvedCharityId == 0 || !_isActiveCharity(resolvedCharityId)) {
            resolvedCharityId = ICharityRegistryForPreferences(charityRegistry).getDefaultCharityId();
            fellBackToDefault = true;
        }

        if (resolvedCharityId == 0 || !_isActiveCharity(resolvedCharityId)) {
            revert CharityResolutionFailed(requestedCharityId);
        }

        charityWallet = ICharityRegistryForPreferences(charityRegistry).getCharityWallet(resolvedCharityId);
        if (charityWallet == address(0)) {
            revert ZeroWalletForResolvedCharity(resolvedCharityId);
        }
    }

    function hasExplicitPreference(address user) external view returns (bool) {
        return _preferences[user].preferredCharityId != 0;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _isActiveCharity(uint256 charityId) internal view returns (bool) {
        return ICharityRegistryForPreferences(charityRegistry).isActiveCharity(charityId);
    }
}