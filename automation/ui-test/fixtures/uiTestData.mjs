export const testData = {
  users: {
    standard: {
      username: 'standard_user',
      password: 'secret_sauce'
    },
    invalid: {
      username: 'invalid_user',
      password: 'invalid_password'
    }
  },
  products: {
    backpack: 'Sauce Labs Backpack',
    bikeLight: 'Sauce Labs Bike Light'
  },
  errors: {
    invalidCredentials: 'Epic sadface: Username and password do not match any user in this service',
    usernameRequired: 'Epic sadface: Username is required'
  }
};
