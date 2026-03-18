// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract UserAcceptancePreferencesRegistry is Ownable {
    enum AcceptanceStatus {
        Unset,
        Accepted,
        Denied
    }

    error ZeroAddressOwner();
    error ZeroPoolId();
    error ZeroMerchantId();
    error ZeroTokenAddress();
    error DuplicatePreferredMerchant(bytes32 merchantId);
    error DuplicatePreferredToken(address token);

    event StrictAcceptedOnlyUpdated(address indexed user, bool enabled);

    event PoolAcceptanceUpdated(
        address indexed user,
        bytes32 indexed poolId,
        AcceptanceStatus oldStatus,
        AcceptanceStatus newStatus
    );

    event MerchantAcceptanceUpdated(
        address indexed user,
        bytes32 indexed merchantId,
        AcceptanceStatus oldStatus,
        AcceptanceStatus newStatus
    );

    event TokenAcceptanceUpdated(
        address indexed user,
        address indexed token,
        AcceptanceStatus oldStatus,
        AcceptanceStatus newStatus
    );

    event PreferredMerchantsReplaced(address indexed user, bytes32[] merchantIds);
    event PreferredTokensReplaced(address indexed user, address[] tokenAddresses);

    mapping(address => bool) private strictAcceptedOnlyByUser;

    mapping(address => mapping(bytes32 => AcceptanceStatus)) private poolStatusByUser;
    mapping(address => mapping(bytes32 => AcceptanceStatus)) private merchantStatusByUser;
    mapping(address => mapping(address => AcceptanceStatus)) private tokenStatusByUser;

    mapping(address => bytes32[]) private acceptedPoolIdsByUser;
    mapping(address => bytes32[]) private deniedPoolIdsByUser;

    mapping(address => bytes32[]) private acceptedMerchantIdsByUser;
    mapping(address => bytes32[]) private deniedMerchantIdsByUser;
    mapping(address => bytes32[]) private preferredMerchantIdsByUser;

    mapping(address => address[]) private acceptedTokenAddressesByUser;
    mapping(address => address[]) private deniedTokenAddressesByUser;
    mapping(address => address[]) private preferredTokenAddressesByUser;

    mapping(address => mapping(bytes32 => uint256)) private acceptedPoolIndexPlusOne;
    mapping(address => mapping(bytes32 => uint256)) private deniedPoolIndexPlusOne;

    mapping(address => mapping(bytes32 => uint256)) private acceptedMerchantIndexPlusOne;
    mapping(address => mapping(bytes32 => uint256)) private deniedMerchantIndexPlusOne;
    mapping(address => mapping(bytes32 => uint256)) private preferredMerchantRankPlusOne;

    mapping(address => mapping(address => uint256)) private acceptedTokenIndexPlusOne;
    mapping(address => mapping(address => uint256)) private deniedTokenIndexPlusOne;
    mapping(address => mapping(address => uint256)) private preferredTokenRankPlusOne;

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddressOwner();
        _transferOwnership(initialOwner);
    }

    function setStrictAcceptedOnly(bool enabled) external {
        strictAcceptedOnlyByUser[msg.sender] = enabled;
        emit StrictAcceptedOnlyUpdated(msg.sender, enabled);
    }

    function isStrictAcceptedOnly(address user) external view returns (bool) {
        return strictAcceptedOnlyByUser[user];
    }

    function setPoolAcceptance(bytes32 poolId, AcceptanceStatus status) external {
        if (poolId == bytes32(0)) revert ZeroPoolId();

        AcceptanceStatus oldStatus = poolStatusByUser[msg.sender][poolId];
        if (oldStatus == status) return;

        _removePoolFromStatusList(msg.sender, poolId, oldStatus);
        poolStatusByUser[msg.sender][poolId] = status;
        _addPoolToStatusList(msg.sender, poolId, status);

        emit PoolAcceptanceUpdated(msg.sender, poolId, oldStatus, status);
    }

    function setMerchantAcceptance(bytes32 merchantId, AcceptanceStatus status) external {
        if (merchantId == bytes32(0)) revert ZeroMerchantId();

        AcceptanceStatus oldStatus = _getMerchantAcceptance(msg.sender, merchantId);
        _setMerchantAcceptance(msg.sender, merchantId, status);
        AcceptanceStatus newStatus = _getMerchantAcceptance(msg.sender, merchantId);

        if (oldStatus != newStatus) {
            emit MerchantAcceptanceUpdated(msg.sender, merchantId, oldStatus, newStatus);
        }
    }

    function replacePreferredMerchants(bytes32[] calldata merchantIds) external {
        _replacePreferredMerchants(msg.sender, merchantIds);
        emit PreferredMerchantsReplaced(msg.sender, merchantIds);
    }

    function setTokenAcceptance(address token, AcceptanceStatus status) external {
        if (token == address(0)) revert ZeroTokenAddress();

        AcceptanceStatus oldStatus = _getTokenAcceptance(msg.sender, token);
        _setTokenAcceptance(msg.sender, token, status);
        AcceptanceStatus newStatus = _getTokenAcceptance(msg.sender, token);

        if (oldStatus != newStatus) {
            emit TokenAcceptanceUpdated(msg.sender, token, oldStatus, newStatus);
        }
    }

    function replacePreferredTokens(address[] calldata tokenAddresses) external {
        _replacePreferredTokens(msg.sender, tokenAddresses);
        emit PreferredTokensReplaced(msg.sender, tokenAddresses);
    }

    function getPoolAcceptance(address user, bytes32 poolId) external view returns (AcceptanceStatus) {
        return poolStatusByUser[user][poolId];
    }

    function getMerchantAcceptance(address user, bytes32 merchantId) external view returns (AcceptanceStatus) {
        return _getMerchantAcceptance(user, merchantId);
    }

    function getTokenAcceptance(address user, address token) external view returns (AcceptanceStatus) {
        return _getTokenAcceptance(user, token);
    }

    function isPoolAccepted(address user, bytes32 poolId) external view returns (bool) {
        return _isAccepted(poolStatusByUser[user][poolId], strictAcceptedOnlyByUser[user]);
    }

    function isMerchantAccepted(address user, bytes32 merchantId) external view returns (bool) {
        return _isAccepted(_getMerchantAcceptance(user, merchantId), strictAcceptedOnlyByUser[user]);
    }

    function isTokenAccepted(address user, address token) external view returns (bool) {
        return _isAccepted(_getTokenAcceptance(user, token), strictAcceptedOnlyByUser[user]);
    }

    function getAcceptedPoolIds(address user) external view returns (bytes32[] memory) {
        return acceptedPoolIdsByUser[user];
    }

    function getDeniedPoolIds(address user) external view returns (bytes32[] memory) {
        return deniedPoolIdsByUser[user];
    }

    function getAcceptedMerchantIds(address user) external view returns (bytes32[] memory) {
        return _getAcceptedMerchantIds(user);
    }

    function getDeniedMerchantIds(address user) external view returns (bytes32[] memory) {
        return deniedMerchantIdsByUser[user];
    }

    function getPreferredMerchantIds(address user) external view returns (bytes32[] memory) {
        return preferredMerchantIdsByUser[user];
    }

    function getAcceptedTokenAddresses(address user) external view returns (address[] memory) {
        return _getAcceptedTokenAddresses(user);
    }

    function getDeniedTokenAddresses(address user) external view returns (address[] memory) {
        return deniedTokenAddressesByUser[user];
    }

    function getPreferredTokenAddresses(address user) external view returns (address[] memory) {
        return preferredTokenAddressesByUser[user];
    }

    function getMerchantPreferenceRank(address user, bytes32 merchantId)
        external
        view
        returns (bool ranked, uint256 rank)
    {
        uint256 rankPlusOne = preferredMerchantRankPlusOne[user][merchantId];
        ranked = rankPlusOne != 0;
        rank = ranked ? rankPlusOne - 1 : 0;
    }

    function getTokenPreferenceRank(address user, address token)
        external
        view
        returns (bool ranked, uint256 rank)
    {
        uint256 rankPlusOne = preferredTokenRankPlusOne[user][token];
        ranked = rankPlusOne != 0;
        rank = ranked ? rankPlusOne - 1 : 0;
    }

    function getRoutingPreferences(address user)
        external
        view
        returns (
            bool strictAcceptedOnly_,
            bytes32[] memory acceptedPoolIds_,
            bytes32[] memory deniedPoolIds_,
            bytes32[] memory acceptedMerchantIds_,
            bytes32[] memory deniedMerchantIds_,
            bytes32[] memory preferredMerchantIds_,
            address[] memory acceptedTokenAddresses_,
            address[] memory deniedTokenAddresses_,
            address[] memory preferredTokenAddresses_
        )
    {
        strictAcceptedOnly_ = strictAcceptedOnlyByUser[user];
        acceptedPoolIds_ = acceptedPoolIdsByUser[user];
        deniedPoolIds_ = deniedPoolIdsByUser[user];
        acceptedMerchantIds_ = _getAcceptedMerchantIds(user);
        deniedMerchantIds_ = deniedMerchantIdsByUser[user];
        preferredMerchantIds_ = preferredMerchantIdsByUser[user];
        acceptedTokenAddresses_ = _getAcceptedTokenAddresses(user);
        deniedTokenAddresses_ = deniedTokenAddressesByUser[user];
        preferredTokenAddresses_ = preferredTokenAddressesByUser[user];
    }

    function _getMerchantAcceptance(address user, bytes32 merchantId) internal view returns (AcceptanceStatus) {
        AcceptanceStatus explicitStatus = merchantStatusByUser[user][merchantId];
        if (explicitStatus == AcceptanceStatus.Denied) {
            return AcceptanceStatus.Denied;
        }
        if (explicitStatus == AcceptanceStatus.Accepted || preferredMerchantRankPlusOne[user][merchantId] != 0) {
            return AcceptanceStatus.Accepted;
        }
        return AcceptanceStatus.Unset;
    }

    function _getTokenAcceptance(address user, address token) internal view returns (AcceptanceStatus) {
        AcceptanceStatus explicitStatus = tokenStatusByUser[user][token];
        if (explicitStatus == AcceptanceStatus.Denied) {
            return AcceptanceStatus.Denied;
        }
        if (explicitStatus == AcceptanceStatus.Accepted || preferredTokenRankPlusOne[user][token] != 0) {
            return AcceptanceStatus.Accepted;
        }
        return AcceptanceStatus.Unset;
    }

    function _isAccepted(AcceptanceStatus status, bool strictAcceptedOnly_) internal pure returns (bool) {
        if (status == AcceptanceStatus.Denied) return false;
        if (status == AcceptanceStatus.Accepted) return true;
        return !strictAcceptedOnly_;
    }

    function _setMerchantAcceptance(address user, bytes32 merchantId, AcceptanceStatus status) internal {
        AcceptanceStatus explicitStatus = merchantStatusByUser[user][merchantId];
        _removeMerchantFromExplicitLists(user, merchantId, explicitStatus);

        if (status == AcceptanceStatus.Denied) {
            _removePreferredMerchant(user, merchantId);
        }

        merchantStatusByUser[user][merchantId] = status;
        _addMerchantToExplicitLists(user, merchantId, status);
    }

    function _setTokenAcceptance(address user, address token, AcceptanceStatus status) internal {
        AcceptanceStatus explicitStatus = tokenStatusByUser[user][token];
        _removeTokenFromExplicitLists(user, token, explicitStatus);

        if (status == AcceptanceStatus.Denied) {
            _removePreferredToken(user, token);
        }

        tokenStatusByUser[user][token] = status;
        _addTokenToExplicitLists(user, token, status);
    }

    function _replacePreferredMerchants(address user, bytes32[] calldata merchantIds) internal {
        bytes32[] storage oldPreferred = preferredMerchantIdsByUser[user];
        for (uint256 i = 0; i < oldPreferred.length; ++i) {
            preferredMerchantRankPlusOne[user][oldPreferred[i]] = 0;
        }
        delete preferredMerchantIdsByUser[user];

        for (uint256 i = 0; i < merchantIds.length; ++i) {
            bytes32 merchantId = merchantIds[i];
            if (merchantId == bytes32(0)) revert ZeroMerchantId();
            if (preferredMerchantRankPlusOne[user][merchantId] != 0) revert DuplicatePreferredMerchant(merchantId);

            if (merchantStatusByUser[user][merchantId] == AcceptanceStatus.Denied) {
                _removeMerchantFromExplicitLists(user, merchantId, AcceptanceStatus.Denied);
                merchantStatusByUser[user][merchantId] = AcceptanceStatus.Unset;
            }

            preferredMerchantIdsByUser[user].push(merchantId);
            preferredMerchantRankPlusOne[user][merchantId] = i + 1;
        }
    }

    function _replacePreferredTokens(address user, address[] calldata tokenAddresses) internal {
        address[] storage oldPreferred = preferredTokenAddressesByUser[user];
        for (uint256 i = 0; i < oldPreferred.length; ++i) {
            preferredTokenRankPlusOne[user][oldPreferred[i]] = 0;
        }
        delete preferredTokenAddressesByUser[user];

        for (uint256 i = 0; i < tokenAddresses.length; ++i) {
            address token = tokenAddresses[i];
            if (token == address(0)) revert ZeroTokenAddress();
            if (preferredTokenRankPlusOne[user][token] != 0) revert DuplicatePreferredToken(token);

            if (tokenStatusByUser[user][token] == AcceptanceStatus.Denied) {
                _removeTokenFromExplicitLists(user, token, AcceptanceStatus.Denied);
                tokenStatusByUser[user][token] = AcceptanceStatus.Unset;
            }

            preferredTokenAddressesByUser[user].push(token);
            preferredTokenRankPlusOne[user][token] = i + 1;
        }
    }

    function _removePoolFromStatusList(address user, bytes32 poolId, AcceptanceStatus status) internal {
        if (status == AcceptanceStatus.Accepted) {
            _removeBytes32(acceptedPoolIdsByUser[user], acceptedPoolIndexPlusOne[user], poolId);
        } else if (status == AcceptanceStatus.Denied) {
            _removeBytes32(deniedPoolIdsByUser[user], deniedPoolIndexPlusOne[user], poolId);
        }
    }

    function _addPoolToStatusList(address user, bytes32 poolId, AcceptanceStatus status) internal {
        if (status == AcceptanceStatus.Accepted) {
            _addBytes32(acceptedPoolIdsByUser[user], acceptedPoolIndexPlusOne[user], poolId);
        } else if (status == AcceptanceStatus.Denied) {
            _addBytes32(deniedPoolIdsByUser[user], deniedPoolIndexPlusOne[user], poolId);
        }
    }

    function _removeMerchantFromExplicitLists(address user, bytes32 merchantId, AcceptanceStatus status) internal {
        if (status == AcceptanceStatus.Accepted) {
            _removeBytes32(acceptedMerchantIdsByUser[user], acceptedMerchantIndexPlusOne[user], merchantId);
        } else if (status == AcceptanceStatus.Denied) {
            _removeBytes32(deniedMerchantIdsByUser[user], deniedMerchantIndexPlusOne[user], merchantId);
        }
    }

    function _addMerchantToExplicitLists(address user, bytes32 merchantId, AcceptanceStatus status) internal {
        if (status == AcceptanceStatus.Accepted) {
            _addBytes32(acceptedMerchantIdsByUser[user], acceptedMerchantIndexPlusOne[user], merchantId);
        } else if (status == AcceptanceStatus.Denied) {
            _addBytes32(deniedMerchantIdsByUser[user], deniedMerchantIndexPlusOne[user], merchantId);
        }
    }

    function _removeTokenFromExplicitLists(address user, address token, AcceptanceStatus status) internal {
        if (status == AcceptanceStatus.Accepted) {
            _removeAddress(acceptedTokenAddressesByUser[user], acceptedTokenIndexPlusOne[user], token);
        } else if (status == AcceptanceStatus.Denied) {
            _removeAddress(deniedTokenAddressesByUser[user], deniedTokenIndexPlusOne[user], token);
        }
    }

    function _addTokenToExplicitLists(address user, address token, AcceptanceStatus status) internal {
        if (status == AcceptanceStatus.Accepted) {
            _addAddress(acceptedTokenAddressesByUser[user], acceptedTokenIndexPlusOne[user], token);
        } else if (status == AcceptanceStatus.Denied) {
            _addAddress(deniedTokenAddressesByUser[user], deniedTokenIndexPlusOne[user], token);
        }
    }

    function _removePreferredMerchant(address user, bytes32 merchantId) internal {
        _removeBytes32(preferredMerchantIdsByUser[user], preferredMerchantRankPlusOne[user], merchantId);
        _reindexPreferredMerchants(user);
    }

    function _removePreferredToken(address user, address token) internal {
        _removeAddress(preferredTokenAddressesByUser[user], preferredTokenRankPlusOne[user], token);
        _reindexPreferredTokens(user);
    }

    function _reindexPreferredMerchants(address user) internal {
        bytes32[] storage preferred = preferredMerchantIdsByUser[user];
        for (uint256 i = 0; i < preferred.length; ++i) {
            preferredMerchantRankPlusOne[user][preferred[i]] = i + 1;
        }
    }

    function _reindexPreferredTokens(address user) internal {
        address[] storage preferred = preferredTokenAddressesByUser[user];
        for (uint256 i = 0; i < preferred.length; ++i) {
            preferredTokenRankPlusOne[user][preferred[i]] = i + 1;
        }
    }

    function _getAcceptedMerchantIds(address user) internal view returns (bytes32[] memory merged) {
        bytes32[] storage explicitAccepted = acceptedMerchantIdsByUser[user];
        bytes32[] storage preferred = preferredMerchantIdsByUser[user];

        merged = new bytes32[](explicitAccepted.length + preferred.length);
        uint256 count;

        for (uint256 i = 0; i < explicitAccepted.length; ++i) {
            merged[count++] = explicitAccepted[i];
        }

        for (uint256 i = 0; i < preferred.length; ++i) {
            bytes32 merchantId = preferred[i];
            if (acceptedMerchantIndexPlusOne[user][merchantId] == 0) {
                merged[count++] = merchantId;
            }
        }

        assembly ("memory-safe") {
            mstore(merged, count)
        }
    }

    function _getAcceptedTokenAddresses(address user) internal view returns (address[] memory merged) {
        address[] storage explicitAccepted = acceptedTokenAddressesByUser[user];
        address[] storage preferred = preferredTokenAddressesByUser[user];

        merged = new address[](explicitAccepted.length + preferred.length);
        uint256 count;

        for (uint256 i = 0; i < explicitAccepted.length; ++i) {
            merged[count++] = explicitAccepted[i];
        }

        for (uint256 i = 0; i < preferred.length; ++i) {
            address token = preferred[i];
            if (acceptedTokenIndexPlusOne[user][token] == 0) {
                merged[count++] = token;
            }
        }

        assembly ("memory-safe") {
            mstore(merged, count)
        }
    }

    function _addBytes32(bytes32[] storage values, mapping(bytes32 => uint256) storage indexPlusOne, bytes32 value)
        internal
    {
        if (indexPlusOne[value] != 0) return;
        values.push(value);
        indexPlusOne[value] = values.length;
    }

    function _removeBytes32(
        bytes32[] storage values,
        mapping(bytes32 => uint256) storage indexPlusOne,
        bytes32 value
    ) internal {
        uint256 index = indexPlusOne[value];
        if (index == 0) return;

        uint256 lastIndex = values.length;
        if (index != lastIndex) {
            bytes32 replacement = values[lastIndex - 1];
            values[index - 1] = replacement;
            indexPlusOne[replacement] = index;
        }

        values.pop();
        delete indexPlusOne[value];
    }

    function _addAddress(address[] storage values, mapping(address => uint256) storage indexPlusOne, address value)
        internal
    {
        if (indexPlusOne[value] != 0) return;
        values.push(value);
        indexPlusOne[value] = values.length;
    }

    function _removeAddress(
        address[] storage values,
        mapping(address => uint256) storage indexPlusOne,
        address value
    ) internal {
        uint256 index = indexPlusOne[value];
        if (index == 0) return;

        uint256 lastIndex = values.length;
        if (index != lastIndex) {
            address replacement = values[lastIndex - 1];
            values[index - 1] = replacement;
            indexPlusOne[replacement] = index;
        }

        values.pop();
        delete indexPlusOne[value];
    }
}
