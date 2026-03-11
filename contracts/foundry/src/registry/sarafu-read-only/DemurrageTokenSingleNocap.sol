pragma solidity >= 0.8.0;


/*
 * ABDK Math 64.64 Smart Contract Library.  Copyright © 2019 by ABDK Consulting.
 * Author: Mikhail Vladimirov <mikhail.vladimirov@gmail.com>
 * License: BSD-4-Clause
 */
 
/**
 * Smart contract library of mathematical functions operating with signed
 * 64.64-bit fixed point numbers.  Signed 64.64-bit fixed point number is
 * basically a simple fraction whose numerator is signed 128-bit integer and
 * denominator is 2^64.  As long as denominator is always the same, there is no
 * need to store it, thus in Solidity signed 64.64-bit fixed point numbers are
 * represented by int128 type holding only the numerator.
 */
library ABDKMath64x64 {
  /*
   * Minimum value signed 64.64-bit fixed point number may have. 
   */
  int128 private constant MIN_64x64 = -0x80000000000000000000000000000000;

  /*
   * Maximum value signed 64.64-bit fixed point number may have. 
   */
  int128 private constant MAX_64x64 = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

  /**
   * Convert signed 256-bit integer number into signed 64.64-bit fixed point
   * number.  Revert on overflow.
   *
   * @param x signed 256-bit integer number
   * @return signed 64.64-bit fixed point number
   */
  function fromInt (int256 x) internal pure returns (int128) {
    unchecked {
      require (x >= -0x8000000000000000 && x <= 0x7FFFFFFFFFFFFFFF);
      return int128 (x << 64);
    }
  }

  /**
   * Convert signed 64.64 fixed point number into signed 64-bit integer number
   * rounding down.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64-bit integer number
   */
  function toInt (int128 x) internal pure returns (int64) {
    unchecked {
      return int64 (x >> 64);
    }
  }

  /**
   * Convert unsigned 256-bit integer number into signed 64.64-bit fixed point
   * number.  Revert on overflow.
   *
   * @param x unsigned 256-bit integer number
   * @return signed 64.64-bit fixed point number
   */
  function fromUInt (uint256 x) internal pure returns (int128) {
    unchecked {
      require (x <= 0x7FFFFFFFFFFFFFFF);
      return int128 (int256 (x << 64));
    }
  }

  /**
   * Convert signed 64.64 fixed point number into unsigned 64-bit integer
   * number rounding down.  Revert on underflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @return unsigned 64-bit integer number
   */
  function toUInt (int128 x) internal pure returns (uint64) {
    unchecked {
      require (x >= 0);
      return uint64 (uint128 (x >> 64));
    }
  }

  /**
   * Convert signed 128.128 fixed point number into signed 64.64-bit fixed point
   * number rounding down.  Revert on overflow.
   *
   * @param x signed 128.128-bin fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function from128x128 (int256 x) internal pure returns (int128) {
    unchecked {
      int256 result = x >> 64;
      require (result >= MIN_64x64 && result <= MAX_64x64);
      return int128 (result);
    }
  }

  /**
   * Convert signed 64.64 fixed point number into signed 128.128 fixed point
   * number.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 128.128 fixed point number
   */
  function to128x128 (int128 x) internal pure returns (int256) {
    unchecked {
      return int256 (x) << 64;
    }
  }

  /**
   * Calculate x + y.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @param y signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function add (int128 x, int128 y) internal pure returns (int128) {
    unchecked {
      int256 result = int256(x) + y;
      require (result >= MIN_64x64 && result <= MAX_64x64);
      return int128 (result);
    }
  }

  /**
   * Calculate x - y.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @param y signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function sub (int128 x, int128 y) internal pure returns (int128) {
    unchecked {
      int256 result = int256(x) - y;
      require (result >= MIN_64x64 && result <= MAX_64x64);
      return int128 (result);
    }
  }

  /**
   * Calculate x * y rounding down.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @param y signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function mul (int128 x, int128 y) internal pure returns (int128) {
    unchecked {
      int256 result = int256(x) * y >> 64;
      require (result >= MIN_64x64 && result <= MAX_64x64);
      return int128 (result);
    }
  }

  /**
   * Calculate x * y rounding towards zero, where x is signed 64.64 fixed point
   * number and y is signed 256-bit integer number.  Revert on overflow.
   *
   * @param x signed 64.64 fixed point number
   * @param y signed 256-bit integer number
   * @return signed 256-bit integer number
   */
  function muli (int128 x, int256 y) internal pure returns (int256) {
    unchecked {
      if (x == MIN_64x64) {
        require (y >= -0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF &&
          y <= 0x1000000000000000000000000000000000000000000000000);
        return -y << 63;
      } else {
        bool negativeResult = false;
        if (x < 0) {
          x = -x;
          negativeResult = true;
        }
        if (y < 0) {
          y = -y; // We rely on overflow behavior here
          negativeResult = !negativeResult;
        }
        uint256 absoluteResult = mulu (x, uint256 (y));
        if (negativeResult) {
          require (absoluteResult <=
            0x8000000000000000000000000000000000000000000000000000000000000000);
          return -int256 (absoluteResult); // We rely on overflow behavior here
        } else {
          require (absoluteResult <=
            0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
          return int256 (absoluteResult);
        }
      }
    }
  }

  /**
   * Calculate x * y rounding down, where x is signed 64.64 fixed point number
   * and y is unsigned 256-bit integer number.  Revert on overflow.
   *
   * @param x signed 64.64 fixed point number
   * @param y unsigned 256-bit integer number
   * @return unsigned 256-bit integer number
   */
  function mulu (int128 x, uint256 y) internal pure returns (uint256) {
    unchecked {
      if (y == 0) return 0;

      require (x >= 0);

      uint256 lo = (uint256 (int256 (x)) * (y & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)) >> 64;
      uint256 hi = uint256 (int256 (x)) * (y >> 128);

      require (hi <= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
      hi <<= 64;

      require (hi <=
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF - lo);
      return hi + lo;
    }
  }

  /**
   * Calculate x / y rounding towards zero.  Revert on overflow or when y is
   * zero.
   *
   * @param x signed 64.64-bit fixed point number
   * @param y signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function div (int128 x, int128 y) internal pure returns (int128) {
    unchecked {
      require (y != 0);
      int256 result = (int256 (x) << 64) / y;
      require (result >= MIN_64x64 && result <= MAX_64x64);
      return int128 (result);
    }
  }

  /**
   * Calculate x / y rounding towards zero, where x and y are signed 256-bit
   * integer numbers.  Revert on overflow or when y is zero.
   *
   * @param x signed 256-bit integer number
   * @param y signed 256-bit integer number
   * @return signed 64.64-bit fixed point number
   */
  function divi (int256 x, int256 y) internal pure returns (int128) {
    unchecked {
      require (y != 0);

      bool negativeResult = false;
      if (x < 0) {
        x = -x; // We rely on overflow behavior here
        negativeResult = true;
      }
      if (y < 0) {
        y = -y; // We rely on overflow behavior here
        negativeResult = !negativeResult;
      }
      uint128 absoluteResult = divuu (uint256 (x), uint256 (y));
      if (negativeResult) {
        require (absoluteResult <= 0x80000000000000000000000000000000);
        return -int128 (absoluteResult); // We rely on overflow behavior here
      } else {
        require (absoluteResult <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
        return int128 (absoluteResult); // We rely on overflow behavior here
      }
    }
  }

  /**
   * Calculate x / y rounding towards zero, where x and y are unsigned 256-bit
   * integer numbers.  Revert on overflow or when y is zero.
   *
   * @param x unsigned 256-bit integer number
   * @param y unsigned 256-bit integer number
   * @return signed 64.64-bit fixed point number
   */
  function divu (uint256 x, uint256 y) internal pure returns (int128) {
    unchecked {
      require (y != 0);
      uint128 result = divuu (x, y);
      require (result <= uint128 (MAX_64x64));
      return int128 (result);
    }
  }

  /**
   * Calculate -x.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function neg (int128 x) internal pure returns (int128) {
    unchecked {
      require (x != MIN_64x64);
      return -x;
    }
  }

  /**
   * Calculate |x|.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function abs (int128 x) internal pure returns (int128) {
    unchecked {
      require (x != MIN_64x64);
      return x < 0 ? -x : x;
    }
  }

  /**
   * Calculate 1 / x rounding towards zero.  Revert on overflow or when x is
   * zero.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function inv (int128 x) internal pure returns (int128) {
    unchecked {
      require (x != 0);
      int256 result = int256 (0x100000000000000000000000000000000) / x;
      require (result >= MIN_64x64 && result <= MAX_64x64);
      return int128 (result);
    }
  }

  /**
   * Calculate arithmetics average of x and y, i.e. (x + y) / 2 rounding down.
   *
   * @param x signed 64.64-bit fixed point number
   * @param y signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function avg (int128 x, int128 y) internal pure returns (int128) {
    unchecked {
      return int128 ((int256 (x) + int256 (y)) >> 1);
    }
  }

  /**
   * Calculate geometric average of x and y, i.e. sqrt (x * y) rounding down.
   * Revert on overflow or in case x * y is negative.
   *
   * @param x signed 64.64-bit fixed point number
   * @param y signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function gavg (int128 x, int128 y) internal pure returns (int128) {
    unchecked {
      int256 m = int256 (x) * int256 (y);
      require (m >= 0);
      require (m <
          0x4000000000000000000000000000000000000000000000000000000000000000);
      return int128 (sqrtu (uint256 (m)));
    }
  }

  /**
   * Calculate x^y assuming 0^0 is 1, where x is signed 64.64 fixed point number
   * and y is unsigned 256-bit integer number.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @param y uint256 value
   * @return signed 64.64-bit fixed point number
   */
  function pow (int128 x, uint256 y) internal pure returns (int128) {
    unchecked {
      bool negative = x < 0 && y & 1 == 1;

      uint256 absX = uint128 (x < 0 ? -x : x);
      uint256 absResult;
      absResult = 0x100000000000000000000000000000000;

      if (absX <= 0x10000000000000000) {
        absX <<= 63;
        while (y != 0) {
          if (y & 0x1 != 0) {
            absResult = absResult * absX >> 127;
          }
          absX = absX * absX >> 127;

          if (y & 0x2 != 0) {
            absResult = absResult * absX >> 127;
          }
          absX = absX * absX >> 127;

          if (y & 0x4 != 0) {
            absResult = absResult * absX >> 127;
          }
          absX = absX * absX >> 127;

          if (y & 0x8 != 0) {
            absResult = absResult * absX >> 127;
          }
          absX = absX * absX >> 127;

          y >>= 4;
        }

        absResult >>= 64;
      } else {
        uint256 absXShift = 63;
        if (absX < 0x1000000000000000000000000) { absX <<= 32; absXShift -= 32; }
        if (absX < 0x10000000000000000000000000000) { absX <<= 16; absXShift -= 16; }
        if (absX < 0x1000000000000000000000000000000) { absX <<= 8; absXShift -= 8; }
        if (absX < 0x10000000000000000000000000000000) { absX <<= 4; absXShift -= 4; }
        if (absX < 0x40000000000000000000000000000000) { absX <<= 2; absXShift -= 2; }
        if (absX < 0x80000000000000000000000000000000) { absX <<= 1; absXShift -= 1; }

        uint256 resultShift = 0;
        while (y != 0) {
          require (absXShift < 64);

          if (y & 0x1 != 0) {
            absResult = absResult * absX >> 127;
            resultShift += absXShift;
            if (absResult > 0x100000000000000000000000000000000) {
              absResult >>= 1;
              resultShift += 1;
            }
          }
          absX = absX * absX >> 127;
          absXShift <<= 1;
          if (absX >= 0x100000000000000000000000000000000) {
              absX >>= 1;
              absXShift += 1;
          }

          y >>= 1;
        }

        require (resultShift < 64);
        absResult >>= 64 - resultShift;
      }
      int256 result = negative ? -int256 (absResult) : int256 (absResult);
      require (result >= MIN_64x64 && result <= MAX_64x64);
      return int128 (result);
    }
  }

  /**
   * Calculate sqrt (x) rounding down.  Revert if x < 0.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function sqrt (int128 x) internal pure returns (int128) {
    unchecked {
      require (x >= 0);
      return int128 (sqrtu (uint256 (int256 (x)) << 64));
    }
  }

  /**
   * Calculate binary logarithm of x.  Revert if x <= 0.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function log_2 (int128 x) internal pure returns (int128) {
    unchecked {
      require (x > 0);

      int256 msb = 0;
      int256 xc = x;
      if (xc >= 0x10000000000000000) { xc >>= 64; msb += 64; }
      if (xc >= 0x100000000) { xc >>= 32; msb += 32; }
      if (xc >= 0x10000) { xc >>= 16; msb += 16; }
      if (xc >= 0x100) { xc >>= 8; msb += 8; }
      if (xc >= 0x10) { xc >>= 4; msb += 4; }
      if (xc >= 0x4) { xc >>= 2; msb += 2; }
      if (xc >= 0x2) msb += 1;  // No need to shift xc anymore

      int256 result = msb - 64 << 64;
      uint256 ux = uint256 (int256 (x)) << uint256 (127 - msb);
      for (int256 bit = 0x8000000000000000; bit > 0; bit >>= 1) {
        ux *= ux;
        uint256 b = ux >> 255;
        ux >>= 127 + b;
        result += bit * int256 (b);
      }

      return int128 (result);
    }
  }

  /**
   * Calculate natural logarithm of x.  Revert if x <= 0.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function ln (int128 x) internal pure returns (int128) {
    unchecked {
      require (x > 0);

      return int128 (int256 (
          uint256 (int256 (log_2 (x))) * 0xB17217F7D1CF79ABC9E3B39803F2F6AF >> 128));
    }
  }

  /**
   * Calculate binary exponent of x.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function exp_2 (int128 x) internal pure returns (int128) {
    unchecked {
      require (x < 0x400000000000000000); // Overflow

      if (x < -0x400000000000000000) return 0; // Underflow

      uint256 result = 0x80000000000000000000000000000000;

      if (x & 0x8000000000000000 > 0)
        result = result * 0x16A09E667F3BCC908B2FB1366EA957D3E >> 128;
      if (x & 0x4000000000000000 > 0)
        result = result * 0x1306FE0A31B7152DE8D5A46305C85EDEC >> 128;
      if (x & 0x2000000000000000 > 0)
        result = result * 0x1172B83C7D517ADCDF7C8C50EB14A791F >> 128;
      if (x & 0x1000000000000000 > 0)
        result = result * 0x10B5586CF9890F6298B92B71842A98363 >> 128;
      if (x & 0x800000000000000 > 0)
        result = result * 0x1059B0D31585743AE7C548EB68CA417FD >> 128;
      if (x & 0x400000000000000 > 0)
        result = result * 0x102C9A3E778060EE6F7CACA4F7A29BDE8 >> 128;
      if (x & 0x200000000000000 > 0)
        result = result * 0x10163DA9FB33356D84A66AE336DCDFA3F >> 128;
      if (x & 0x100000000000000 > 0)
        result = result * 0x100B1AFA5ABCBED6129AB13EC11DC9543 >> 128;
      if (x & 0x80000000000000 > 0)
        result = result * 0x10058C86DA1C09EA1FF19D294CF2F679B >> 128;
      if (x & 0x40000000000000 > 0)
        result = result * 0x1002C605E2E8CEC506D21BFC89A23A00F >> 128;
      if (x & 0x20000000000000 > 0)
        result = result * 0x100162F3904051FA128BCA9C55C31E5DF >> 128;
      if (x & 0x10000000000000 > 0)
        result = result * 0x1000B175EFFDC76BA38E31671CA939725 >> 128;
      if (x & 0x8000000000000 > 0)
        result = result * 0x100058BA01FB9F96D6CACD4B180917C3D >> 128;
      if (x & 0x4000000000000 > 0)
        result = result * 0x10002C5CC37DA9491D0985C348C68E7B3 >> 128;
      if (x & 0x2000000000000 > 0)
        result = result * 0x1000162E525EE054754457D5995292026 >> 128;
      if (x & 0x1000000000000 > 0)
        result = result * 0x10000B17255775C040618BF4A4ADE83FC >> 128;
      if (x & 0x800000000000 > 0)
        result = result * 0x1000058B91B5BC9AE2EED81E9B7D4CFAB >> 128;
      if (x & 0x400000000000 > 0)
        result = result * 0x100002C5C89D5EC6CA4D7C8ACC017B7C9 >> 128;
      if (x & 0x200000000000 > 0)
        result = result * 0x10000162E43F4F831060E02D839A9D16D >> 128;
      if (x & 0x100000000000 > 0)
        result = result * 0x100000B1721BCFC99D9F890EA06911763 >> 128;
      if (x & 0x80000000000 > 0)
        result = result * 0x10000058B90CF1E6D97F9CA14DBCC1628 >> 128;
      if (x & 0x40000000000 > 0)
        result = result * 0x1000002C5C863B73F016468F6BAC5CA2B >> 128;
      if (x & 0x20000000000 > 0)
        result = result * 0x100000162E430E5A18F6119E3C02282A5 >> 128;
      if (x & 0x10000000000 > 0)
        result = result * 0x1000000B1721835514B86E6D96EFD1BFE >> 128;
      if (x & 0x8000000000 > 0)
        result = result * 0x100000058B90C0B48C6BE5DF846C5B2EF >> 128;
      if (x & 0x4000000000 > 0)
        result = result * 0x10000002C5C8601CC6B9E94213C72737A >> 128;
      if (x & 0x2000000000 > 0)
        result = result * 0x1000000162E42FFF037DF38AA2B219F06 >> 128;
      if (x & 0x1000000000 > 0)
        result = result * 0x10000000B17217FBA9C739AA5819F44F9 >> 128;
      if (x & 0x800000000 > 0)
        result = result * 0x1000000058B90BFCDEE5ACD3C1CEDC823 >> 128;
      if (x & 0x400000000 > 0)
        result = result * 0x100000002C5C85FE31F35A6A30DA1BE50 >> 128;
      if (x & 0x200000000 > 0)
        result = result * 0x10000000162E42FF0999CE3541B9FFFCF >> 128;
      if (x & 0x100000000 > 0)
        result = result * 0x100000000B17217F80F4EF5AADDA45554 >> 128;
      if (x & 0x80000000 > 0)
        result = result * 0x10000000058B90BFBF8479BD5A81B51AD >> 128;
      if (x & 0x40000000 > 0)
        result = result * 0x1000000002C5C85FDF84BD62AE30A74CC >> 128;
      if (x & 0x20000000 > 0)
        result = result * 0x100000000162E42FEFB2FED257559BDAA >> 128;
      if (x & 0x10000000 > 0)
        result = result * 0x1000000000B17217F7D5A7716BBA4A9AE >> 128;
      if (x & 0x8000000 > 0)
        result = result * 0x100000000058B90BFBE9DDBAC5E109CCE >> 128;
      if (x & 0x4000000 > 0)
        result = result * 0x10000000002C5C85FDF4B15DE6F17EB0D >> 128;
      if (x & 0x2000000 > 0)
        result = result * 0x1000000000162E42FEFA494F1478FDE05 >> 128;
      if (x & 0x1000000 > 0)
        result = result * 0x10000000000B17217F7D20CF927C8E94C >> 128;
      if (x & 0x800000 > 0)
        result = result * 0x1000000000058B90BFBE8F71CB4E4B33D >> 128;
      if (x & 0x400000 > 0)
        result = result * 0x100000000002C5C85FDF477B662B26945 >> 128;
      if (x & 0x200000 > 0)
        result = result * 0x10000000000162E42FEFA3AE53369388C >> 128;
      if (x & 0x100000 > 0)
        result = result * 0x100000000000B17217F7D1D351A389D40 >> 128;
      if (x & 0x80000 > 0)
        result = result * 0x10000000000058B90BFBE8E8B2D3D4EDE >> 128;
      if (x & 0x40000 > 0)
        result = result * 0x1000000000002C5C85FDF4741BEA6E77E >> 128;
      if (x & 0x20000 > 0)
        result = result * 0x100000000000162E42FEFA39FE95583C2 >> 128;
      if (x & 0x10000 > 0)
        result = result * 0x1000000000000B17217F7D1CFB72B45E1 >> 128;
      if (x & 0x8000 > 0)
        result = result * 0x100000000000058B90BFBE8E7CC35C3F0 >> 128;
      if (x & 0x4000 > 0)
        result = result * 0x10000000000002C5C85FDF473E242EA38 >> 128;
      if (x & 0x2000 > 0)
        result = result * 0x1000000000000162E42FEFA39F02B772C >> 128;
      if (x & 0x1000 > 0)
        result = result * 0x10000000000000B17217F7D1CF7D83C1A >> 128;
      if (x & 0x800 > 0)
        result = result * 0x1000000000000058B90BFBE8E7BDCBE2E >> 128;
      if (x & 0x400 > 0)
        result = result * 0x100000000000002C5C85FDF473DEA871F >> 128;
      if (x & 0x200 > 0)
        result = result * 0x10000000000000162E42FEFA39EF44D91 >> 128;
      if (x & 0x100 > 0)
        result = result * 0x100000000000000B17217F7D1CF79E949 >> 128;
      if (x & 0x80 > 0)
        result = result * 0x10000000000000058B90BFBE8E7BCE544 >> 128;
      if (x & 0x40 > 0)
        result = result * 0x1000000000000002C5C85FDF473DE6ECA >> 128;
      if (x & 0x20 > 0)
        result = result * 0x100000000000000162E42FEFA39EF366F >> 128;
      if (x & 0x10 > 0)
        result = result * 0x1000000000000000B17217F7D1CF79AFA >> 128;
      if (x & 0x8 > 0)
        result = result * 0x100000000000000058B90BFBE8E7BCD6D >> 128;
      if (x & 0x4 > 0)
        result = result * 0x10000000000000002C5C85FDF473DE6B2 >> 128;
      if (x & 0x2 > 0)
        result = result * 0x1000000000000000162E42FEFA39EF358 >> 128;
      if (x & 0x1 > 0)
        result = result * 0x10000000000000000B17217F7D1CF79AB >> 128;

      result >>= uint256 (int256 (63 - (x >> 64)));
      require (result <= uint256 (int256 (MAX_64x64)));

      return int128 (int256 (result));
    }
  }

  /**
   * Calculate natural exponent of x.  Revert on overflow.
   *
   * @param x signed 64.64-bit fixed point number
   * @return signed 64.64-bit fixed point number
   */
  function exp (int128 x) internal pure returns (int128) {
    unchecked {
      require (x < 0x400000000000000000); // Overflow

      if (x < -0x400000000000000000) return 0; // Underflow

      return exp_2 (
          int128 (int256 (x) * 0x171547652B82FE1777D0FFDA0D23A7D12 >> 128));
    }
  }

  /**
   * Calculate x / y rounding towards zero, where x and y are unsigned 256-bit
   * integer numbers.  Revert on overflow or when y is zero.
   *
   * @param x unsigned 256-bit integer number
   * @param y unsigned 256-bit integer number
   * @return unsigned 64.64-bit fixed point number
   */
  function divuu (uint256 x, uint256 y) private pure returns (uint128) {
    unchecked {
      require (y != 0);

      uint256 result;

      if (x <= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        result = (x << 64) / y;
      else {
        uint256 msb = 192;
        uint256 xc = x >> 192;
        if (xc >= 0x100000000) { xc >>= 32; msb += 32; }
        if (xc >= 0x10000) { xc >>= 16; msb += 16; }
        if (xc >= 0x100) { xc >>= 8; msb += 8; }
        if (xc >= 0x10) { xc >>= 4; msb += 4; }
        if (xc >= 0x4) { xc >>= 2; msb += 2; }
        if (xc >= 0x2) msb += 1;  // No need to shift xc anymore

        result = (x << 255 - msb) / ((y - 1 >> msb - 191) + 1);
        require (result <= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);

        uint256 hi = result * (y >> 128);
        uint256 lo = result * (y & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);

        uint256 xh = x >> 192;
        uint256 xl = x << 64;

        if (xl < lo) xh -= 1;
        xl -= lo; // We rely on overflow behavior here
        lo = hi << 128;
        if (xl < lo) xh -= 1;
        xl -= lo; // We rely on overflow behavior here

        assert (xh == hi >> 128);

        result += xl / y;
      }

      require (result <= 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
      return uint128 (result);
    }
  }

  /**
   * Calculate sqrt (x) rounding down, where x is unsigned 256-bit integer
   * number.
   *
   * @param x unsigned 256-bit integer number
   * @return unsigned 128-bit integer number
   */
  function sqrtu (uint256 x) private pure returns (uint128) {
    unchecked {
      if (x == 0) return 0;
      else {
        uint256 xx = x;
        uint256 r = 1;
        if (xx >= 0x100000000000000000000000000000000) { xx >>= 128; r <<= 64; }
        if (xx >= 0x10000000000000000) { xx >>= 64; r <<= 32; }
        if (xx >= 0x100000000) { xx >>= 32; r <<= 16; }
        if (xx >= 0x10000) { xx >>= 16; r <<= 8; }
        if (xx >= 0x100) { xx >>= 8; r <<= 4; }
        if (xx >= 0x10) { xx >>= 4; r <<= 2; }
        if (xx >= 0x4) { r <<= 1; }
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1;
        r = (r + x / r) >> 1; // Seven iterations should be enough
        uint256 r1 = x / r;
        return uint128 (r < r1 ? r : r1);
      }
    }
  }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
contract DemurrageTokenSingleNocap {

	uint256 constant VALUE_LIMIT = 1 << 63;

	struct redistributionItem {
		uint32 period;
		uint72 value;
		uint64 demurrage;
	}
	redistributionItem[] public redistributions;

	// Account balances
	mapping (address => uint256) account;
	
	// Cached demurrage amount, ppm with 38 digit resolution
	//uint128 public demurrageAmount;
	int128 public demurrageAmount;

	// Cached demurrage timestamp; the timestamp for which demurrageAmount was last calculated
	uint256 public demurrageTimestamp;

	// Implements EIP173
	address public owner;

	address newOwner;

	// Implements ERC20
	string public name;

	// Implements ERC20
	string public symbol;

	// Implements ERC20
	uint256 public immutable decimals;

	uint256 supply;

	// Last executed period
	uint256 public lastPeriod;

	// Last sink redistribution amount
	uint256 public totalSink;

	// Value of burnt tokens (burnt tokens do not decay)
	uint256 burned;

	// 128 bit resolution of the demurrage divisor
	// (this constant x 1000000 is contained within 128 bits)
	//uint256 constant nanoDivider = 100000000000000000000000000; // now nanodivider, 6 zeros less

	// remaining decimal positions of nanoDivider to reach 38, equals precision in growth and decay
	//uint256 constant growthResolutionFactor = 1000000000000;

	// demurrage decimal width; 38 places
	//uint256 public immutable resolutionFactor = nanoDivider * growthResolutionFactor; 

	// Timestamp of start of periods (time which contract constructor was called)
	uint256 public immutable periodStart;

	// Duration of a single redistribution period in seconds
	uint256 public immutable periodDuration;

	// Demurrage in ppm per minute
	//uint256 public immutable decayLevel;
	// 64x64
	int128 public immutable decayLevel;
		
	// Addresses allowed to mint new tokens
	mapping (address => bool) minter;

	// Storage for ERC20 approve/transferFrom methods
	mapping (address => mapping (address => uint256 ) ) public allowance; // holder -> spender -> amount (amount is subject to demurrage)

	// Address to send unallocated redistribution tokens
	address public sinkAddress; 

	// timestamp when token contract expires
	uint256 public expires;
	bool expired;

	// supply xap
	uint256 public maxSupply;

	// Implements ERC20
	event Transfer(address indexed _from, address indexed _to, uint256 _value);

	// Implements ERC20
	event Approval(address indexed _owner, address indexed _spender, uint256 _value);

	// Implements Minter
	event Mint(address indexed _minter, address indexed _beneficiary, uint256 _value);

	// New demurrage cache milestone calculated
	event Decayed(uint256 indexed _period, uint256 indexed _periodCount, int128 indexed _oldAmount, int128 _newAmount);

	// When a new period threshold has been crossed
	event Period(uint256 _period);

	// Redistribution applied on a single eligible account
	event Redistribution(address indexed _account, uint256 indexed _period, uint256 _value);

	// Temporary event used in development, will be removed on prod
	//event Debug(bytes32 _foo);
	event Debug(int128 indexed _foo, uint256 indexed _bar);

	// Implements Burn
	event Burn(address indexed _burner, uint256 _value);

	// EIP173
	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner); // EIP173

	// Implements Expire
	event Expired(uint256 _timestamp);

	// Implements Expire
	event ExpiryChange(uint256 indexed _oldTimestamp, uint256 _newTimestamp);

	event Cap(uint256 indexed _oldCap, uint256 _newCap);

	// Implements Seal
	uint256 public sealState;
	uint8 constant WRITER_STATE = 1;
	uint8 constant SINK_STATE = 2;
	uint8 constant EXPIRY_STATE = 4;
	uint8 constant CAP_STATE = 8;
	// Implements Seal
	uint256 constant public maxSealState = 15;

	// Implements Seal
	event SealStateChange(bool indexed _final, uint256 _sealState);


	constructor(string memory _name, string memory _symbol, uint8 _decimals, int128 _decayLevel, uint256 _periodMinutes, address _defaultSinkAddress) {
		require(_decayLevel < (1 << 64));
		redistributionItem memory initialRedistribution;

		//require(ABDKMath64x64.toUInt(_decayLevel) == 0);

		// ACL setup
		owner = msg.sender;

		// ERC20 setup
		name = _name;
		symbol = _symbol;
		decimals = _decimals;

		// Demurrage setup
		demurrageTimestamp = block.timestamp;
		periodStart = demurrageTimestamp;
		periodDuration = _periodMinutes * 60;
		demurrageAmount = ABDKMath64x64.fromUInt(1);

		decayLevel = ABDKMath64x64.ln(_decayLevel);
		initialRedistribution = toRedistribution(0, demurrageAmount, 0, 1);
		redistributions.push(initialRedistribution);

		// Misc settings
		sinkAddress = _defaultSinkAddress;
	}

	function seal(uint256 _state) public returns(uint256) {
		require(msg.sender == owner);
		require(_state < 16, 'ERR_INVALID_STATE');
		require(_state & sealState == 0, 'ERR_ALREADY_LOCKED');
		sealState |= _state;
		emit SealStateChange(sealState == maxSealState, sealState);
		return uint256(sealState);
	}

	function isSealed(uint256 _state) public view returns(bool) {
		require(_state < maxSealState);
		if (_state == 0) {
			return sealState == maxSealState;
		}
		return _state & sealState == _state;
	}

	// Set when token expires. 
	// Value is set it terms of redistribution periods.
	// Cannot be set to a time in the past.
	function setExpirePeriod(uint256 _expirePeriod) public {
		uint256 r;
		uint256 oldTimestamp;

		require(!isSealed(EXPIRY_STATE));
		require(!expired);
		require(msg.sender == owner);
		r = periodStart + (_expirePeriod * periodDuration);
		require(r > expires);
		oldTimestamp = expires;
		expires = r;
		emit ExpiryChange(oldTimestamp, expires);
	}

	// Change max token supply.
	// Can only increase supply cap, not decrease.
	function setMaxSupply(uint256 _cap) public {
		require(!isSealed(CAP_STATE));
		require(msg.sender == owner);
		require(_cap > totalSupply());
		emit Cap(maxSupply, _cap);
		maxSupply = _cap;
	}

	// Change sink address for redistribution
	function setSinkAddress(address _sinkAddress) public {
		require(!isSealed(SINK_STATE));
		require(msg.sender == owner);
		sinkAddress = _sinkAddress;
	}

	// Expire the contract if expire is set and we have gone over the threshold.
	// Finalizes demurrage up to the timestamp of the expiry. 
	// The first approve, transfer or transferFrom call that hits the ex == 2 will get the tx mined. but without the actual effect. Otherwise we would have to wait until an external egent called applyExpiry to get the correct final balance.
	// Implements Expire
	function applyExpiry() public returns(uint8) {
		if (expired) {
			return 1;
		}
		if (expires == 0) {
			return 0;
		}
		if (block.timestamp >= expires) {
			applyDemurrageLimited(expires - demurrageTimestamp / 60);
			expired = true;
			emit Expired(block.timestamp);
			changePeriod();
			return 2;
		}
		return 0;
	}

	// Given address will be allowed to call the mintTo() function
	// Implements Writer
	function addWriter(address _minter) public returns (bool) {
		require(!isSealed(WRITER_STATE));
		require(msg.sender == owner);
		minter[_minter] = true;
		return true;
	}

	// Given address will no longer be allowed to call the mintTo() function
	// Implements Writer
	function deleteWriter(address _minter) public returns (bool) {
		require(!isSealed(WRITER_STATE));
		require(msg.sender == owner || _minter == msg.sender);
		minter[_minter] = false;
		return true;
	}

	// Implements Writer
	function isWriter(address _minter) public view returns(bool) {
		return minter[_minter] || _minter == owner;
	}

	/// Implements ERC20
	function balanceOf(address _account) public view returns (uint256) {
		int128 baseBalance;
		int128 currentDemurragedAmount;
		uint256 periodCount;

		baseBalance = ABDKMath64x64.fromUInt(baseBalanceOf(_account));

		periodCount = getMinutesDelta(demurrageTimestamp);

		currentDemurragedAmount = ABDKMath64x64.mul(baseBalance, demurrageAmount);
		return decayBy(ABDKMath64x64.toUInt(currentDemurragedAmount), periodCount);
	}

	// Balance unmodified by demurrage
	function baseBalanceOf(address _account) public view returns (uint256) {
		return account[_account];
	}

	/// Increases base balance for a single account
	function increaseBaseBalance(address _account, uint256 _delta) private returns (bool) {
		uint256 oldBalance;
		uint256 workAccount;

		workAccount = uint256(account[_account]);
	
		if (_delta == 0) {
			return false;
		}

		oldBalance = baseBalanceOf(_account);
		account[_account] = oldBalance + _delta;
		return true;
	}

	/// Decreases base balance for a single account
	function decreaseBaseBalance(address _account, uint256 _delta) private returns (bool) {
		uint256 oldBalance;
		uint256 workAccount;

		workAccount = uint256(account[_account]);

		if (_delta == 0) {
			return false;
		}

		oldBalance = baseBalanceOf(_account);	
		require(oldBalance >= _delta, 'ERR_OVERSPEND'); // overspend guard
		account[_account] = oldBalance - _delta;
		return true;
	}

	// Send full balance of one account to another
	function sweep(address _account) public returns (uint256) {
		uint256 v;

		v = account[msg.sender];
		account[msg.sender] = 0;
		account[_account] += v;
		emit Transfer(msg.sender, _account, v);
		return v;
	}

	// Creates new tokens out of thin air, and allocates them to the given address
	// Triggers tax
	// Implements Minter
	function mintTo(address _beneficiary, uint256 _amount) public returns (bool) {
		uint256 baseAmount;

		require(applyExpiry() == 0);
		require(minter[msg.sender] || msg.sender == owner, 'ERR_ACCESS');

		changePeriod();
		if (maxSupply > 0) {
			require(supply + _amount <= maxSupply);
		}
		supply += _amount;

		baseAmount = toBaseAmount(_amount);
		increaseBaseBalance(_beneficiary, baseAmount);
		emit Mint(msg.sender, _beneficiary, _amount);
		saveRedistributionSupply();
		return true;
	}

	// Implements Minter
	function mint(address _beneficiary, uint256 _amount, bytes calldata _data) public {
		_data;
		mintTo(_beneficiary, _amount);
	}

	// Implements Minter
	function safeMint(address _beneficiary, uint256 _amount, bytes calldata _data) public {
		_data;
		mintTo(_beneficiary, _amount);
	}

	// Deserializes the redistribution word
	function toRedistribution(uint256 _participants, int128 _demurrageModifier, uint256 _value, uint256 _period) public pure returns(redistributionItem memory) {
		redistributionItem memory redistribution;

		redistribution.period = uint32(_period);
		redistribution.value = uint72(_value);
		redistribution.demurrage = uint64(uint128(_demurrageModifier) & 0xffffffffffffffff);
		_participants;
		return redistribution;

	}

	// Serializes the demurrage period part of the redistribution word
	function toRedistributionPeriod(redistributionItem memory _redistribution) public pure returns (uint256) {
		return uint256(_redistribution.period);
	}

	// Serializes the supply part of the redistribution word
	function toRedistributionSupply(redistributionItem memory _redistribution) public pure returns (uint256) {
		return uint256(_redistribution.value);
	}

	// Serializes the number of participants part of the redistribution word
	function toRedistributionDemurrageModifier(redistributionItem memory _redistribution) public pure returns (int128) {
		int128 r;

		r = int128(int64(_redistribution.demurrage) & int128(0x0000000000000000ffffffffffffffff));
		if (r == 0) {
			r = ABDKMath64x64.fromUInt(1);
		}
		return r;
	}

	// Client accessor to the redistributions array length
	function redistributionCount() public view returns (uint256) {
		return redistributions.length;
	}

	// Save the current total supply amount to the current redistribution period
	function saveRedistributionSupply() private returns (bool) {
		redistributionItem memory currentRedistribution;
		uint256 grownSupply;

		grownSupply = totalSupply();
		currentRedistribution = redistributions[redistributions.length-1];
		currentRedistribution.value = uint72(grownSupply);

		redistributions[redistributions.length-1] = currentRedistribution;
		return true;
	}

	// Get the demurrage period of the current block number
	function actualPeriod() public view returns (uint128) {
		return uint128((block.timestamp - periodStart) / periodDuration + 1);
	}

	// Retrieve next redistribution if the period threshold has been crossed
	function checkPeriod() private view returns (redistributionItem memory) {
		redistributionItem memory lastRedistribution;
		redistributionItem memory emptyRedistribution;
		uint256 currentPeriod;

		lastRedistribution =  redistributions[lastPeriod];
		currentPeriod = this.actualPeriod();
		if (currentPeriod <= toRedistributionPeriod(lastRedistribution)) {
			return emptyRedistribution;
		}
		return lastRedistribution;
	}

	function getDistribution(uint256 _supply, int128 _demurrageAmount) public pure returns (uint256) {
		int128 difference;

		difference = ABDKMath64x64.mul(ABDKMath64x64.fromUInt(_supply), ABDKMath64x64.sub(ABDKMath64x64.fromUInt(1), _demurrageAmount));
		return _supply - ABDKMath64x64.toUInt(difference);
			
	}

	function getDistributionFromRedistribution(redistributionItem memory _redistribution) public pure returns (uint256) {
		uint256 redistributionSupply;
		int128 redistributionDemurrage;

		redistributionSupply = toRedistributionSupply(_redistribution);
		redistributionDemurrage = toRedistributionDemurrageModifier(_redistribution);
		return getDistribution(redistributionSupply, redistributionDemurrage);
	}

	// Returns the amount sent to the sink address
	function applyDefaultRedistribution(redistributionItem memory _redistribution) private returns (uint256) {
		uint256 unit;
		uint256 baseUnit;
	
		unit = totalSupply() - getDistributionFromRedistribution(_redistribution);	
		baseUnit = toBaseAmount(unit) - totalSink;
		increaseBaseBalance(sinkAddress, baseUnit);
		emit Redistribution(sinkAddress, _redistribution.period, unit);
		lastPeriod += 1;
		totalSink += baseUnit;
		return unit;
	}

	// Recalculate the demurrage modifier for the new period
	// Note that the supply for the consecutive period will be taken at the time of code execution, and thus not necessarily at the time when the redistribution period threshold was crossed.
	function changePeriod() public returns (bool) {
		redistributionItem memory currentRedistribution;
		redistributionItem memory nextRedistribution;
		redistributionItem memory lastRedistribution;
		uint256 currentPeriod;
		int128 lastDemurrageAmount;
		int128 nextRedistributionDemurrage;
		uint256 demurrageCounts;
		uint256 nextPeriod;

		applyDemurrage();
		currentRedistribution = checkPeriod();
		if (isEmptyRedistribution(currentRedistribution)) {
			return false;
		}

		// calculate the decay from previous redistributino
		lastRedistribution = redistributions[lastPeriod];
		currentPeriod = toRedistributionPeriod(currentRedistribution);
		nextPeriod = currentPeriod + 1;
		lastDemurrageAmount = toRedistributionDemurrageModifier(lastRedistribution);
		demurrageCounts = (periodDuration * currentPeriod) / 60;
		// TODO refactor decayby to take int128 then DRY with it
		nextRedistributionDemurrage = ABDKMath64x64.exp(ABDKMath64x64.mul(decayLevel, ABDKMath64x64.fromUInt(demurrageCounts)));
		nextRedistribution = toRedistribution(0, nextRedistributionDemurrage, totalSupply(), nextPeriod);
		redistributions.push(nextRedistribution);

		applyDefaultRedistribution(nextRedistribution);
		emit Period(nextPeriod);
		return true;
	}

	// Calculate the time delta in whole minutes passed between given timestamp and current timestamp
	function getMinutesDelta(uint256 _lastTimestamp) public view returns (uint256) {
		return (block.timestamp - _lastTimestamp) / 60;
	}

	// Calculate and cache the demurrage value corresponding to the (period of the) time of the method call
	function applyDemurrage() public returns (uint256) {
		return applyDemurrageLimited(0);
	}

	// returns true if expired
	function applyDemurrageLimited(uint256 _rounds) public returns (uint256) {
		int128 v;
		uint256 periodCount;
		int128 periodPoint;
		int128 lastDemurrageAmount;

		if (expired) {
			return 0; 
		}

		periodCount = getMinutesDelta(demurrageTimestamp);
		if (periodCount == 0) {
			return 0;
		}
		lastDemurrageAmount = demurrageAmount;
	
		// safety limit for exponential calculation to ensure that we can always
		// execute this code no matter how much time passes.			
		if (_rounds > 0 && _rounds < periodCount) {
			periodCount = _rounds;
		}

		periodPoint = ABDKMath64x64.fromUInt(periodCount);
		v = ABDKMath64x64.mul(decayLevel, periodPoint);
		v = ABDKMath64x64.exp(v);
		demurrageAmount = ABDKMath64x64.mul(demurrageAmount, v);

		demurrageTimestamp = demurrageTimestamp + (periodCount * 60);
		emit Decayed(demurrageTimestamp, periodCount, lastDemurrageAmount, demurrageAmount);
		return periodCount;
	}

	// Return timestamp of start of period threshold
	function getPeriodTimeDelta(uint256 _periodCount) public view returns (uint256) {
		return periodStart + (_periodCount * periodDuration);
	}

	// Amount of demurrage cycles inbetween the current timestamp and the given target time
	function demurrageCycles(uint256 _target) public view returns (uint256) {
		return (block.timestamp - _target) / 60;
	}

	// Equality check for empty redistribution data
	function isEmptyRedistribution(redistributionItem memory _redistribution) public pure returns(bool) {
		if (_redistribution.period > 0) {
			return false;
		}
		if (_redistribution.value > 0) {
			return false;
		}
		if (_redistribution.demurrage > 0) {
			return false;
		}
		return true;
	}


	// Calculate a value reduced by demurrage by the given period
	function decayBy(uint256 _value, uint256 _period)  public view returns (uint256) {
		int128 valuePoint;
		int128 periodPoint;
		int128 v;
	
		valuePoint = ABDKMath64x64.fromUInt(_value);
		periodPoint = ABDKMath64x64.fromUInt(_period);

		v = ABDKMath64x64.mul(decayLevel, periodPoint);
		v = ABDKMath64x64.exp(v);
		v = ABDKMath64x64.mul(valuePoint, v);
		return ABDKMath64x64.toUInt(v);
	}


	// Inflates the given amount according to the current demurrage modifier
	function toBaseAmount(uint256 _value) public view returns (uint256) {
		int128 r;
		r = ABDKMath64x64.div(ABDKMath64x64.fromUInt(_value), demurrageAmount);
		return ABDKMath64x64.toUInt(r);
	}

	// Triggers tax and/or redistribution
	// Implements ERC20
	function approve(address _spender, uint256 _value) public returns (bool) {
		uint256 baseValue;
		uint8 ex;

		ex = applyExpiry();
		if (ex == 2) {
			return false;	
		} else if (ex > 0) {
			revert('EXPIRED');
		}
		if (allowance[msg.sender][_spender] > 0) {
			require(_value == 0, 'ZERO_FIRST');
		}
		
		changePeriod();

		// dex code will attempt uint256max approve, but contract cannot handle that size
		// truncate to biggest possible value
		if (_value <= VALUE_LIMIT) {
			baseValue = toBaseAmount(_value);
		} else {
			baseValue = VALUE_LIMIT;
		}

		allowance[msg.sender][_spender] = baseValue;
		emit Approval(msg.sender, _spender, _value);
		return true;
	}

	// Reduce allowance by amount
	function decreaseAllowance(address _spender, uint256 _value) public returns (bool) {
		uint256 baseValue;

		baseValue = toBaseAmount(_value);
		require(allowance[msg.sender][_spender] >= baseValue);
		
		changePeriod();

		allowance[msg.sender][_spender] -= baseValue;
		emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
		return true;
	}

	// Increase allowance by amount
	function increaseAllowance(address _spender, uint256 _value) public returns (bool) {
		uint256 baseValue;

		changePeriod();

		baseValue = toBaseAmount(_value);

		allowance[msg.sender][_spender] += baseValue;
		emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
		return true;
	}

	// Triggers tax and/or redistribution
	// Implements ERC20
	function transfer(address _to, uint256 _value) public returns (bool) {
		uint256 baseValue;
		bool result;
		uint8 ex;

		ex = applyExpiry();
		if (ex == 2) {
			return false;	
		} else if (ex > 0) {
			revert('EXPIRED');
		}
		changePeriod();

		baseValue = toBaseAmount(_value);
		result = transferBase(msg.sender, _to, baseValue);
		emit Transfer(msg.sender, _to, _value);
		return result;
	}

	// Triggers tax and/or redistribution
	// Implements ERC20
	function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
		uint256 baseValue;
		bool result;
		uint8 ex;

		ex = applyExpiry();
		if (ex == 2) {
			return false;	
		} else if (ex > 0) {
			revert('EXPIRED');
		}
		changePeriod();

		baseValue = toBaseAmount(_value);
		require(allowance[_from][msg.sender] >= baseValue);

		allowance[_from][msg.sender] -= baseValue;
		result = transferBase(_from, _to, baseValue);

		emit Transfer(_from, _to, _value);
		return result;
	}

	// ERC20 transfer backend for transfer, transferFrom
	function transferBase(address _from, address _to, uint256 _value) private returns (bool) {
		decreaseBaseBalance(_from, _value);
		increaseBaseBalance(_to, _value);

		return true;
	}

	// Implements EIP173
	function transferOwnership(address _newOwner) public returns (bool) {
		address oldOwner;

		require(msg.sender == owner);
		oldOwner = owner;
		owner = _newOwner;

		emit OwnershipTransferred(oldOwner, owner);
		return true;
	}

	// Explicitly and irretrievably burn tokens
	// Only token minters can burn tokens
	// Implements Burner
	function burn(uint256 _value) public returns(bool) {
		require(applyExpiry() == 0);
		require(minter[msg.sender] || msg.sender == owner, 'ERR_ACCESS');
		require(_value <= account[msg.sender]);
		uint256 _delta = toBaseAmount(_value);

		//applyDemurrage();
		decreaseBaseBalance(msg.sender, _delta);
		burned += _value;
		emit Burn(msg.sender, _value);
		return true;
	}

	// Implements Burner
	function burn(address _from, uint256 _value, bytes calldata _data) public {
		require(_from == msg.sender, 'ERR_ONLY_SELF_BURN');
		_data;
		burn(_value);
	}

	// Implements Burner
	function burn() public returns(bool) {
		return burn(account[msg.sender]);
	}

	// Implements ERC20
	function totalSupply() public view returns (uint256) {
		return supply - burned;
	}

	// Return total number of burned tokens
	// Implements Burner
	function totalBurned() public view returns (uint256) {
		return burned;
	}

	// Return total number of tokens ever minted
	// Implements Burner
	function totalMinted() public view returns (uint256) {
		return supply;
	}


	// Implements EIP165
	function supportsInterface(bytes4 _sum) public pure returns (bool) {
		if (_sum == 0xb61bc941) { // ERC20
			return true;
		}
		if (_sum == 0x5878bcf4) { // Minter
			return true;
		}
		if (_sum == 0xbc4babdd) { // Burner
			return true;
		}
		if (_sum == 0x0d7491f8) { // Seal
			return true;
		}
		if (_sum == 0xabe1f1f5) { // Writer
			return true;
		}
		if (_sum == 0x841a0e94) { // Expire
			return true;
		}
		if (_sum == 0x01ffc9a7) { // ERC165
			return true;
		}
		if (_sum == 0x9493f8b2) { // ERC173
			return true;
		}
		if (_sum == 0xd0017968) { // ERC5678Ext20
			return true;
		}
		return false;
	}
}