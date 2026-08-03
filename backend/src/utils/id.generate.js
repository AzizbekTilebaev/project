import crypto from 'crypto';

class IdGenerator {
    /**
     * Tasodifiy qisqa ID yaratish (hex)
     * @param {number} length - ID uzunligi (default 8)
     * @returns {string}
     */
    generateShortId(length = 8) {
        return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    }

    /**
     * Prefix bilan vaqtinchalik ID yaratish
     * @param {string} prefix - Prefix (default 'desc')
     * @returns {string}
     */
    generateTempId(prefix = 'desc') {
        return `${prefix}_${this.generateShortId(6)}`;
    }
}

export default IdGenerator;