/* eslint-disable react-hooks/exhaustive-deps */
import {
  getDescriptorFromSchema,
  getDescriptorSimple,
  formatPathFromValidator,
  isPathRequired,
  getArray,
  getSchemaFromFlatten,
  dataToKeys,
  destructDataPath,
  getDataPath,
  isExpression,
  parseSingleExpression,
  getKeyFromPath,
  generateDataSkeleton,
  isObject,
} from './utils';
import { defaultValidateMessagesCN } from './validateMessageCN';
import { defaultValidateMessages } from './validateMessage';
import Validator from 'async-validator';
import { get, merge } from 'lodash-es';

export function allPromiseFinish(promiseList) {
  let hasError = false;
  let count = promiseList.length;
  const results = [];

  if (!promiseList.length) {
    return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    promiseList.forEach((promise, index) => {
      promise
        .catch(e => {
          hasError = true;
          return e;
        })
        .then(result => {
          count -= 1;
          results[index] = result;

          if (count > 0) {
            return;
          }

          if (hasError) {
            reject(results);
          }
          resolve(results);
        });
    });
  });
}

const parseSchemaExpression = (schema, formData, path) => {
  if (!isObject(schema)) return schema;
  const result = {};
  Object.keys(schema).forEach(key => {
    const item = schema[key];
    if (isObject(item)) {
      result[key] = parseSchemaExpression(item, formData, path);
    } else if (isExpression(item)) {
      result[key] = parseSingleExpression(item, formData, path);
    } else {
      result[key] = item;
    }
  });
  return result;
};

// pathFromData => allPath
const getAllPaths = (paths, flatten) => {
  if (!Array.isArray(paths)) return [];
  const result = [...paths]
    .filter(p => p.indexOf(']') > -1)
    .map(p1 => {
      const last = p1.lastIndexOf(']');
      return p1.substring(0, last + 1);
    });

  const removeDups = arr => {
    if (!Array.isArray(arr)) {
      console.log('in removeDups: param is not an array');
      return;
    }
    var array = [];
    for (var i = 0; i < arr.length; i++) {
      if (array.indexOf(arr[i]) === -1) {
        array.push(arr[i]);
      }
    }
    return array;
  };

  const uniqueResult = removeDups(result);

  let res = [...paths];
  uniqueResult.forEach(result => {
    const { id, dataIndex } = destructDataPath(result);
    if (flatten[id]) {
      const children = flatten[id].children;
      const childrenWithIndex = children
        .map(child => {
          if (child.slice(-1) !== ']') {
            return getDataPath(child, dataIndex);
          } else {
            return undefined;
          }
        })
        .filter(i => !!i);
      res = [...res, ...childrenWithIndex];
    }
  });
  return removeDups(res);
};

export const validateAll = ({
  formData,
  flatten,
  options, // {locale = 'cn', validateMessages = {}}
}) => {
  // console.log(formData, dataToKeys(formData), 'dataToKeysdataToKeys');
  const paths = dataToKeys(formData);
  const allPaths = getAllPaths(paths, flatten);
  const promiseArray = allPaths.map(path => {
    const { id, dataIndex } = destructDataPath(path);
    if (flatten[id]) {
      console.log('______________', id);
      const singleData = get(formData, path);
      let schema = flatten[id].schema || {};
      const finalSchema = parseSchemaExpression(schema, formData, path);
      return validateSingle(singleData, finalSchema, path, options); // is a promise
    } else {
      return Promise.resolve();
    }
  });

  return allPromiseFinish(promiseArray)
    .then(res => {
      const errorMap = res
        .filter(item => Array.isArray(item) && item.length > 0)
        .map(item => {
          const name = item[0].field;
          const error = item.map(m => m.message);
          return { name, error };
        });
      console.log('errorMap', errorMap);
      return errorMap;
    })
    .catch(e => {
      console.log(e);
    });
};

const validateSingle = (data, schema = {}, path, options = {}) => {
  if (schema.hidden === true) {
    console.log('validateSingle:hidden true', schema.$id);
    return Promise.resolve();
  }

  const { validateMessages = {}, locale = 'cn' } = options;
  const cn = defaultValidateMessagesCN;
  const en = defaultValidateMessages;
  const descriptor = getDescriptorSimple(schema, path);
  // TODO: 有些情况会出现没有rules，需要看一下，先兜底
  let validator;
  try {
    validator = new Validator(descriptor);
  } catch (error) {
    console.log(error, 'new validator error');
    return Promise.resolve();
  }
  let messageFeed = locale === 'en' ? en : cn;
  merge(messageFeed, validateMessages);
  validator.messages(messageFeed);
  return validator
    .validate({ [path]: data })
    .then(res => {
      // if (touchVerifyList.length > 0) return touchVerifyList;
      return [];
    })
    .catch(({ errors, fields }) => {
      return errors;
    });
};

// 无用
// const theRest = () => {
//   let _schema = getSchemaFromFlatten(flatten);
//   if (Object.keys(_schema).length === 0) return Promise.resolve();
//   const descriptor = getDescriptorFromSchema({
//     schema: _schema,
//     isRequired,
//   }).fields;
//   window.descriptor = descriptor;

//   let touchVerifyList = [];

//   // 如果是最后的校验，所有key都touch了，就不用算这个了
//   // 因为要整个构建validator在list的情况太复杂了，所以required单独拿出来处理，但是这边有不少单独处理逻辑，例如message
//   if (!isRequired) {
//     touchedKeys.forEach(key => {
//       const keyRequired = isPathRequired(key, _schema);
//       const val = get(formData, key);
//       const nullValue = [undefined, null, ''].indexOf(val) > -1; // 注意 0 不是
//       const isEmptyMultiSelect = Array.isArray(val) && val.length === 0;
//       if ((nullValue || isEmptyMultiSelect) && keyRequired.required) {
//         const _message =
//           keyRequired.message || validateMessages.required || '${title}必填';
//         touchVerifyList.push({ name: key, error: [_message] });
//       }
//     });
//   }

//   const cn = defaultValidateMessagesCN;
//   const en = defaultValidateMessages;

//   // TODO: 有些情况会出现没有rules，需要看一下，先兜底
//   let validator;
//   try {
//     validator = new Validator(descriptor);
//   } catch (error) {
//     return Promise.resolve([]);
//   }
//   let messageFeed = locale === 'en' ? en : cn;
//   merge(messageFeed, validateMessages);
//   validator.messages(messageFeed);
//   return validator
//     .validate(formData || {})
//     .then(res => {
//       if (touchVerifyList.length > 0) return touchVerifyList;
//       return [];
//     })
//     .catch(({ errors, fields }) => {
//       // error的name改成正常的path
//       let normalizedErrors = getArray(errors).map(err => {
//         const _path = formatPathFromValidator(err.field);
//         return { name: _path, error: [err.message] };
//       });
//       // 添加touched的required
//       normalizedErrors = [...normalizedErrors, ...touchVerifyList];
//       // 合并同名的error
//       let _errorFields = [];
//       normalizedErrors.forEach(item => {
//         const matchIndex = _errorFields.findIndex(
//           ele => ele.name === item.name
//         );
//         if (matchIndex === -1) {
//           _errorFields.push(item);
//         } else {
//           _errorFields[matchIndex].error = [
//             ..._errorFields[matchIndex].error,
//             ...item.error,
//           ];
//         }
//       });
//       return _errorFields;
//     });
// };

// var d3 = {
//   list: {
//     type: 'array',
//     defaultField: {
//       type: 'object',
//       fields: {
//         userName: [
//           {
//             bind: false,
//             title: 'User Name',
//             type: 'string',
//             rules: [
//               {
//                 min: 5,
//                 message: '长度需要大于5',
//               },
//               {
//                 max: 12,
//               },
//             ],
//           },
//           {
//             min: 5,
//             message: '长度需要大于5',
//           },
//           {
//             max: 12,
//           },
//         ],
//         selectName: {
//           title: '单选',
//           type: 'string',
//           enum: ['a', 'b', 'c'],
//           enumNames: ['早', '中', '晚'],
//           required: true,
//         },
//         checkboxName: {
//           title: '是否判断',
//           type: 'boolean',
//           valuePropName: 'checked',
//         },
//       },
//     },
//   },
// };

// var d2 = {
//   list: {
//     type: 'array',
//     defaultField: {
//       type: 'object',
//       fields: {
//         userName: [
//           {
//             bind: false,
//             title: 'User Name',
//             type: 'string',
//             rules: [
//               {
//                 min: 5,
//                 message: '长度需要大于5',
//               },
//               {
//                 max: 12,
//               },
//             ],
//           },
//           {
//             min: 5,
//             message: '长度需要大于5',
//           },
//           {
//             max: 12,
//           },
//         ],
//         selectName: {
//           title: '单选',
//           type: 'string',
//           enum: ['a', 'b', 'c'],
//           enumNames: ['早', '中', '晚'],
//           required: true,
//         },
//         checkboxName: {
//           title: '是否判断',
//           type: 'boolean',
//           valuePropName: 'checked',
//         },
//       },
//     },
//   },
// };
